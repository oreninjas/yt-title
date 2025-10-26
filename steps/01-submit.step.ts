import { ApiRouteConfig } from "motia";

// Step 1 -
// Accept channel name and email to start the workflow
export const config: ApiRouteConfig = {
  name: "SubmitChannel",
  type: "api",
  path: "/submit",
  method: "POST",
  emits: ["yt.submit"],
};

interface SubmitRequest {
  channel: string;
  email: string;
}

export const handler = async (req: any, { emit, logger, state }: any) => {
  try {
    logger.info("received submission request: ", { body: req.body });
    const { channel, email } = req.body as SubmitRequest;

    if (!channel || !email) {
      return {
        status: 400,
        body: "Missing required inputs: channel or email",
      };
    }

    // validate
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        status: 400,
        body: "Invalid email format",
      };
    }

    const jobId = `job_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    await state.set(`job: ${jobId}`, {
      jobId,
      channel,
      email,
      status: "queued",
      createdAt: new Date().toISOString(),
    });

    logger.info("Job created!", { jobId, channel, email });

    await emit({
      topic: "yt.submit",
      data: { jobId, channel, email },
    });

    return {
      status: 202,
      body: {
        succes: true,
        jobId,
        message: "Working on the request",
      },
    };
  } catch (error: any) {
    logger.error("Error in submission handler: ", { error: error.message });
    return {
      status: 500,
      body: {
        error: "Internal server error",
      },
    };
  }
};
