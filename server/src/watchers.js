import path from "path";
import fs from "fs";

import { l } from "./utils.js";

export const watchFilesListRequest = (peer, base) => {
  peer.on("askfiles", async (data) => {
    const route = data.toString();
    const files = await l(path.join(base, route), route);
    peer.emit("answerfiles", JSON.stringify(files));
  });
};

export const watchDownloadRequest = (peer, base) => {
  peer.on("askdownload", async (data) => {
    const route = path.join(base, data.toString());
    peer.emit("answerdownload", fs.createReadStream(route));
  });
};
