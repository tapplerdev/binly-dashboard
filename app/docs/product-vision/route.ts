import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET() {
  const html = fs.readFileSync(
    path.join(process.cwd(), "docs", "product-vision.html"),
    "utf-8"
  );

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
