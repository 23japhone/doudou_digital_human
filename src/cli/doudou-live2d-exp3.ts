import { pathToFileURL } from "node:url";
import {
  exportDefaultDoudouLive2DExp3Directory,
  validateDoudouLive2DExp3Directory
} from "../runtime/default-doudou-exp3.js";

export async function runDoudouLive2DExp3Cli(argv: string[]): Promise<number> {
  const command = argv[2];
  const targetDir = argv[3];
  if (!isCommand(command) || !targetDir || argv.length > 4) {
    console.error("Usage: doudou-live2d-exp3 <export|validate> <expressions-dir>");
    return 2;
  }

  try {
    if (command === "export") {
      const result = await exportDefaultDoudouLive2DExp3Directory(targetDir);
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }

    const result = await validateDoudouLive2DExp3Directory(targetDir);
    const output = JSON.stringify(result, null, 2);
    if (result.ok) {
      console.log(output);
      return 0;
    }

    console.error(output);
    return 1;
  } catch {
    console.error(
      JSON.stringify(
        {
          ok: false,
          issues: [`Unable to ${command} default Doudou Live2D expressions.`]
        },
        null,
        2
      )
    );
    return 1;
  }
}

function isCommand(value: unknown): value is "export" | "validate" {
  return value === "export" || value === "validate";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runDoudouLive2DExp3Cli(process.argv)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
