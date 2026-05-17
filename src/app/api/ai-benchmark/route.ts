import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import type { SvrPredictionRequestPayload, SvrPredictionResult } from "@/types/tender";

const DEFAULT_ML_SERVICE_URL = "http://127.0.0.1:8001";
const PYTHON_EXECUTABLE = process.env["PYTHON_EXECUTABLE"] || "python";
const WINDOWS_PY_LAUNCHER = "py";

async function invokeFastApiService(payload: SvrPredictionRequestPayload) {
  const baseUrl = process.env["ML_SERVICE_URL"] || DEFAULT_ML_SERVICE_URL;
  const response = await fetch(`${baseUrl}/predict-benchmark`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const result = (await response.json()) as
    | SvrPredictionResult
    | { detail?: string; error?: string };

  if (!response.ok) {
    throw new Error(
      ("detail" in result && result.detail) ||
        ("error" in result && result.error) ||
        "ML benchmark service returned an error."
    );
  }

  return result;
}

async function invokeLocalPythonFallback(payload: SvrPredictionRequestPayload) {
  const scriptPath = path.join(process.cwd(), "ml_service", "predict_once.py");

  const runPredictionWithCommand = (command: string, args: string[]) =>
    new Promise<SvrPredictionResult>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        reject(error);
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Python fallback exited with code ${code}.`));
          return;
        }

        try {
          resolve(JSON.parse(stdout) as SvrPredictionResult);
        } catch (error) {
          reject(
            new Error(
              error instanceof Error
                ? `Fallback prediction payload invalid: ${error.message}`
                : "Fallback prediction payload invalid."
            )
          );
        }
      });

      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    });

  try {
    return await runPredictionWithCommand(PYTHON_EXECUTABLE, [scriptPath]);
  } catch (primaryError) {
    if (process.platform !== "win32") {
      throw primaryError;
    }

    return runPredictionWithCommand(WINDOWS_PY_LAUNCHER, ["-3", scriptPath]);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SvrPredictionRequestPayload;

    try {
      const result = await invokeFastApiService(payload);

      return NextResponse.json(result);
    } catch (serviceError) {
      try {
        const fallbackResult = await invokeLocalPythonFallback(payload);

        return NextResponse.json(fallbackResult);
      } catch (fallbackError) {
        throw new Error(
          [
            "AI benchmark gagal dijalankan.",
            serviceError instanceof Error
              ? `FastAPI service: ${serviceError.message}`
              : "FastAPI service: unknown error",
            fallbackError instanceof Error
              ? `Local Python fallback: ${fallbackError.message}`
              : "Local Python fallback: unknown error",
          ].join(" ")
        );
      }
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal menghubungkan Next.js ke service benchmark AI.",
      },
      {
        status: 500,
      }
    );
  }
}
