import express, { Request, Response } from "express";
import { spawn } from "child_process";
import youtubedl from "youtube-dl-exec";
import fs from "fs";

const app = express();
const port = 3030;
const videoDirectory = "clipped_videos"; // Specify the directory to save clipped videos

app.get("/clip", async (req: Request, res: Response) => {
  const youtubeLink = req.query.link as string;
  const start = req.query.start as string;
  const end = req.query.end as string;

  if (!youtubeLink || !start || !end) {
    return res.status(400).send("Missing link, start, or end");
  }

  try {
    if (!fs.existsSync(videoDirectory)) {
      fs.mkdirSync(videoDirectory);
    }

    let videoTitle = (await youtubedl(youtubeLink, {
      getFilename: true,
    })) as unknown as string;

    const clippedVideoFilename = `${
      Date.now().toString() + "-" + Math.random().toString().replace(".", "")
    }.mp4`;
    const clippedVideoPath = `${videoDirectory}/${clippedVideoFilename}`;

    // if (!fs.existsSync(clippedVideoPath)) {
    await youtubedl(youtubeLink);

    const newFullPath = `${videoDirectory}/${encodeURI(videoTitle)}`;

    fs.renameSync(videoTitle, newFullPath);

    videoTitle = newFullPath;

    const ffmpegProcess = spawn("ffmpeg", [
      "-ss",
      start,
      "-i",
      newFullPath,
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
      // for some reason ffmpeg's output is logged as stderr...
      console.error(`FFmpeg error: ${data}`);
    });

    ffmpegProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`FFmpeg process exited with code ${code}`);
      }

      res.setHeader("Content-Type", "text/html");

      res.send(`
        <video src="${clippedVideoPath}" autoplay="true">
        </video>
        `);
    });
  } catch (error) {
    console.error(`Error: ${error}`);
    return res.status(500).send("An error occurred");
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});

app.get("/clipped_videos/:path", (req, res) => {
  console.log(req.params);

  const file = `clipped_videos/${req.params.path}`;
  const length = fs.statSync(file);
  const stream = fs.createReadStream(file);
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", length.size);
  stream.pipe(res);
});
