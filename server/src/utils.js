import path from "path";
import { promises as fs } from "fs";

export const l = async (localRoute, route) => {
  const fileInfo = async (name) => ({
    name: name || path.basename(localRoute),
    route: path.join(route, name),
    extension: path.extname(name || localRoute),
    fileSizeInBytes: (await fs.stat(path.join(localRoute, name))).size,
  });

  return fs.lstat(localRoute).then(async (stat) =>
    stat.isFile()
      ? [await fileInfo("")]
      : await fs
          .readdir(localRoute, "utf8")
          .catch(() => [])
          .then((files) => Promise.all(files.map(fileInfo)))
  );
};
