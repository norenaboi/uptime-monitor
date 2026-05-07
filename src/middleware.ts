import crypto from "crypto";
import dotenv from "dotenv";
import { Request, Response, NextFunction } from "express";

dotenv.config();

const MASTER_KEY: string | undefined = process.env.MASTER_KEY;

if (!MASTER_KEY || MASTER_KEY.trim().length < 16) {
  console.error("FATAL: MASTER_KEY is not set or too short after reload.");
  process.exit(1);
}

export function verifyMasterKey(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const provided: string | undefined = req.headers.authorization;
  const expected = MASTER_KEY;
  let valid = false;
  try {
    valid =
      provided !== undefined &&
      expected !== undefined &&
      provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch (_) {}

  if (!valid) {
    return res.status(403).json({ error: "Invalid master key" });
  }

  next();
}
