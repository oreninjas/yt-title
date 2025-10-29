import { EventConfig } from "motia";
import { z, ZodArray, ZodObject } from "zod";

// Step 2 -
// Converts youtube handle/name to channel ID using youtube data api
export type ZodInput = ZodObject<any> | ZodArray<any>;
export const config: EventConfig = {
  name: "ResolveChannel",
  type: "event",
  subscribes: ["yt.submit"],
  emits: ["yt.submit.resolved", "yt.channel.error"],
  input: z.object({
    jobId: z.string(),
    email: z.string(),
    channel: z.string(),
  }),
};

export const handler = async (eventData: any, { emit, logger, state }: any) => {
  let jobId: string | undefined;
  let email: string | undefined;
  let channel: string | null = null;

  try {
    const data = eventData || {};
    jobId = data.jobId;
    email = data.email;
    channel = data.channel;
    logger.info("Resolving YouTube channel", { jobId, channel });

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    if (!YOUTUBE_API_KEY) {
      throw new Error("YouTube API key is not configured");
    }

    const jobData = await state.get(`job: ${jobId}`);
    await state.set(`job: ${jobId}`, {
      ...jobData,
      status: "resolving channel",
    });

    let channelId: string | null = null;
    let channelName: string = "";

    if (channel && channel.startsWith("@")) {
      const handle = channel.substring(1);

      const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(
        handle
      )}&key=${YOUTUBE_API_KEY}`;

      const channelsRes = await fetch(channelsUrl);
      const channelsData = await channelsRes.json();

      if (channelsData.items && channelsData.items.length > 0) {
        channelId = channelsData.items[0].id;
        channelName = channelsData.items[0].snippet.title;
        logger.info("Resolved channel by handle", { channelId, channelName });
      }
    }

    if (!channelId) {
      logger.error("Channel not found", { channel });
      await state.set(`job:${jobId}`, {
        ...jobData,
        status: "failed",
        error: "Channel not found",
      });
      await emit({
        topic: "yt.submit.error",
        data: {
          jobId,
          email,
        },
      });
      return;
    }

    await emit({
      topic: "yt.submit.resolved",
      data: {
        jobId,
        email,
      },
    });

    return;
  } catch (error: any) {
    logger.error("Error resolving channel", {
      channel,
      jobId,
      error: error.message,
    });

    if (!jobId || !email) {
      logger.error("Cannot send error notification - missing job id or email");
      return;
    }

    const jobData = await state.get(`job: ${jobId}`);

    await state.set(`job: ${jobId}`, {
      ...jobData,
      status: "failed",
      error: error.message,
    });

    await emit({
      topic: "yt.channel.error",
      data: {
        jobId,
        email,
        error: "Failed  to resolve channel. Please try again",
      },
    });
  }
};
