import express, { Request, Response } from "express";
import { spawn } from "child_process";
import youtubedl from "youtube-dl-exec";
import fs from "fs";

const app = express();
const port = 3030;
const videoDirectory = "clipped_videos"; // Specify the directory to save clipped videos

app.get("/stream", async (req: Request, res: Response) => {
  const youtubeLink = req.query.link as string;
  const start = req.query.start as string;
  const end = req.query.end as string;

  if (!youtubeLink || !start || !end) {
    return res.status(400).send("Missing link, start, or end");
  }

  try {

    let videoTitle = (await youtubedl(youtubeLink, {
      getFilename: true,
    })) as unknown as string;

    const clippedVideoFilename = `${videoTitle}-${start}-${end}.mp4`;
    const clippedVideoPath = `${videoDirectory}/${clippedVideoFilename}`;

    if (!fs.existsSync(clippedVideoPath)) {
      await youtubedl(youtubeLink);
      console.log("downloaded the file");
      const newFullPath = `${videoDirectory}/${encodeURI(videoTitle)}`;
      console.log("about to move file");
      fs.renameSync(videoTitle, newFullPath);
      console.log("moved file");
      videoTitle = newFullPath;

      console.log("about to clip");
      const ffmpegProcess = spawn("ffmpeg", [
        "-ss",
        start,
        "-i",
        videoTitle,
        "-to",
        end,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        "-movflags",
        "frag_keyframe+empty_moov",
        "-f",
        "mp4",
        clippedVideoPath,
      ]);

      ffmpegProcess.stderr.on("data", (data) => {
        console.error(`FFmpeg error: ${data}`);
      });
      ffmpegProcess.on("close", (code) => {
        if (code !== 0) {
          console.error(`FFmpeg process exited with code ${code}`);
        }

        // const stream = fs.createReadStream(clippedVideoPath);

        // res.setHeader('Content-Type', 'video/mp4');
        // res.setHeader('Accept-Ranges', 'bytes');
        // stream.pipe(res);

        res.setHeader("Content-Type", "text/html");

        res.send(`
        <video src="${clippedVideoPath}" autoplay="true">
        </video>
        `);
      });
    }

    const stream = fs.createReadStream(clippedVideoPath);

    // res.setHeader('Content-Type', 'video/mp4');
    // res.setHeader('Accept-Ranges', 'bytes');
    // stream.pipe(res);

    res.setHeader("Content-Type", "text/html");

    res.send(`
        <video src="${clippedVideoPath}" autoplay="true">
        </video>
        `);
  } catch (error) {
    console.error(`Error: ${error}`);
    return res.status(500).send("An error occurred");
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
