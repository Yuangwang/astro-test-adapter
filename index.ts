import * as fs from "node:fs/promises";
import { stringify as yamlStringify } from "yaml";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fsExtra from "fs-extra";
import {exec } from "child_process"
import { createRequire } from 'module';
import path from 'path';
// export default function createIntegration() {
//   return {
//     name: "wei-astro-test",
//     hooks: {
//       // "astro:config:setup": ({ updateConfig, config }) => {
//       //   updateConfig({
//       //     outDir: new URL("./.apphosting/", config.root),
//       //     build: {
//       //       client: new URL("./.apphosting/client", config.root),
//       //       server: new URL("./.apphosting/server", config.root),
//       //       redirects: false,
//       //     },
//       //   });
//       //   console.log(config);
//       // },
//       "astro:config:done": ({ setAdapter, config }) => {
//         setAdapter({
//           name: "wei-astro-test",
//           serverEntrypoint: 'wei-astro-test/server.js',
//           previewEntrypoint: 'wei-astro-test/preview.js',
//           exports: ['handler', 'startServer', 'options'],
//           adapterFeatures: {
//             buildOutput: 'server',
//             edgeMiddleware: false,
//           },
//           supportedAstroFeatures: {
//             hybridOutput: 'stable',
//             staticOutput: 'stable',
//             serverOutput: 'stable',
//             sharpImageService: 'stable',
//             i18nDomains: 'experimental',
//             envGetSecret: 'stable',
//           },
//         });
//         console.log(config);
//       },
//       "astro:build:done": async ({ routes, logger }) => {
//         console.log("HERE");
//         await fs.writeFile(
//           `./config.json`,
//           JSON.stringify({ test: "test" }, null, "\t"),
//           { encoding: "utf-8" }
//         );
//       },
//     },
//   };
// }

import type { AstroAdapter, AstroIntegration } from 'astro';
import { AstroError } from 'astro/errors';
import type { Options, UserOptions } from './types.js';
export const { move, exists, writeFile, readJson, readdir, readFileSync, existsSync, mkdir } =
fsExtra;

export function getAdapter(options: Options): AstroAdapter {
  const require = createRequire(import.meta.url);
  const serverEntrypoint = path.join(require.resolve('@astrojs/node'), '../server.js');
  const previewEntrypoint = path.join(require.resolve('@astrojs/node'), '../preview.js');
	return {
    name: "astro-test-wei",
    serverEntrypoint: serverEntrypoint,
    previewEntrypoint: previewEntrypoint,
		exports: ['handler', 'startServer', 'options'],
		args: options,
		adapterFeatures: {
			buildOutput: 'server',
			edgeMiddleware: false,
		},
		supportedAstroFeatures: {
			hybridOutput: 'stable',
			staticOutput: 'stable',
			serverOutput: 'stable',
			sharpImageService: 'stable',
			i18nDomains: 'experimental',
			envGetSecret: 'stable',
		},
	};
}

export default function createIntegration(userOptions: UserOptions): AstroIntegration {
	if (!userOptions?.mode) {
		throw new AstroError(`Setting the 'mode' option is required.`);
	}

	let _options: Options;
	return {
		name: 'astro-test-wei',
		hooks: {
			'astro:config:setup': async ({ updateConfig, config }) => {
				updateConfig({
					image: {
						endpoint: config.image.endpoint ?? 'astro/assets/endpoint/node',
					},
					vite: {
						ssr: {
							noExternal: ['astro-test-wei'],
						},
					},
				});
			},
			'astro:config:done': ({ setAdapter, config }) => {
				_options = {
					...userOptions,
					client: config.build.client?.toString(),
					server: config.build.server?.toString(),
					host: config.server.host,
					port: config.server.port,
					assets: config.build.assets,
				};
				setAdapter(getAdapter(_options));
			},
      "astro:build:done": async (config) => {
        await fs.mkdir("./.apphosting")
        const directoryName = dirname(fileURLToPath(import.meta.url));
        const packageJsonPath = `${directoryName}/../package.json`;
        if (!existsSync(packageJsonPath)) {
          throw new Error(`Next.js adapter package.json file does not exist at ${packageJsonPath}`);
        }
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
        const packageName = "astro";
        const packageVersion = await getPackageVersion(packageName);
        const outputBundle: OutputBundleConfig = {
          version: "v1",
          runConfig: {
            runCommand: `node dist/server/entry.mjs`,
            environmentVariables: [{variable:"HOST", value:"0.0.0.0", availability:[Availability.Runtime]}]
          },
          metadata: {
            adapterPackageName: packageJson.name,
            adapterVersion: packageJson.version,
            framework: packageName,
            frameworkVersion: packageVersion
          },
        };
        await fs.writeFile(
          `./.apphosting/bundle.yaml`,
          yamlStringify(outputBundle)
        );
      },
		},
	};
}

function getPackageVersion(packageName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`npm view ${packageName} version`, (error, stdout, stderr) => {
      if (error) {
        reject(error); 
        return;
      }
      const version = stdout.trim();
      resolve(version); 
    });
  });
}


// Output bundle metadata specifications to be written to bundle.yaml
export interface OutputBundleConfig {
  version: "v1";
  runConfig: RunConfig;
  metadata: Metadata;
}

// Fields needed to configure the App Hosting server
export interface RunConfig {
  // Command to start the server (e.g. "node dist/index.js"). Assume this command is run from the root dir of the workspace
  runCommand: string;
  // Environment variables set when the app is run
  environmentVariables?: EnvVarConfig[];
  // See https://firebase.google.com/docs/reference/apphosting/rest/v1beta/projects.locations.backends.builds#runconfig for documentation on the next fields
  // The maximum number of concurrent requests that each server instance can receive.
  concurrency?: number;
  // The number of CPUs used in a single server instance.
  cpu?: number;
  // The amount of memory available for a server instance.
  memoryMiB?: number;
  // The limit on the minimum number of function instances that may coexist at a given time.
  minInstances?: number;
  // The limit on the maximum number of function instances that may coexist at a given time.
  maxInstances?: number;
}

// Additonal fields needed for identifying the framework and adapter being used
export interface Metadata {
  // Name of the adapter (this should be the official package name) e.g. "@apphosting/adapter-nextjs"
  adapterPackageName: string;
  // Version of the adapter, e.g. "18.0.1"
  adapterVersion: string;
  // Name of the framework that is being supported, e.g. "angular"
  framework: string;
  // Version of the framework that is being supported, e.g. "18.0.1"
  frameworkVersion?: string;
}

// Represents a single environment variable.
export interface EnvVarConfig {
  // Name of the variable
  variable: string;
  // Value associated with the variable
  value: string;
  // Where the variable will be available, for now only RUNTIME is supported
  availability: Availability.Runtime[];
}

// Represents where environment variables are made available
export enum Availability {
  // Runtime environment variables are available on the server when the app is run
  Runtime = "RUNTIME",
}

