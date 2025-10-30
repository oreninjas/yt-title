import { EventConfig, Handlers } from "motia";

// Step 3 -
// Retrives the latest 5 videos from the channel ID
export const config: EventConfig = {
  name: "FetchVideos",
  type: "event",
  subscribes: ["yt.channel.resolved"],
  emits: ["yt.videos.fetched", "yt.videos.error"],
};

interface Video {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  thumbnail: string;
}

export const handler: Handlers["FetchVideos"] = async (
  eventData: any,
  { emit, logger, state }: any
) => {
  logger.info("Fetch process starts here");
  let jobId: string | undefined;
  let email: string | undefined;
  let channel: string | undefined;
  try {
    const data = eventData || {};
    jobId = data.jobId;
    email = data.email;
    channel = data.channel;
    const channelId = data.channelId;
    const channelName = data.channelName;

    logger.info("Fetching", { jobId, channelId });

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) {
      throw new Error("YouTube API key is not configured");
    }

    const jobData = await state.get(`job: ${jobId}`);
    await state.set(`job: ${jobId}`, {
      ...jobData,
      status: "fetching videos",
    });

    // max results set to 5
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=5`;

    const response = await fetch(searchUrl);
    const youtubeData = await response.json();
    if (!youtubeData.items || youtubeData.items.length === 0) {
      logger.warn("No videos found for channel", { jobId, channelId });
      await state.set(`job:${jobId}`, {
        ...jobData,
        status: "failed",
        error: "No videos found",
      });

      await emit({
        topic: "yt.videos.error",
        data: {
          jobId,
          email,
          error: "No videos found on channel",
        },
      });
      return;
    }

    const videos: Video[] = youtubeData.items.map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails.default.url,
    }));

    logger.info("Videos fetched successfully: ", {
      jobId,
      videoCount: videos.length,
    });

    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "videos fetched",
      videos,
    });

    await emit({
      topic: "yt.videos.fetched",
      data: {
        jobId,
        channelId,
        channelName,
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
      topic: "yt.videos.error",
      data: {
        jobId,
        email,
        error: "Failed  to fetch videos. Please try again",
      },
    });
  }
};
