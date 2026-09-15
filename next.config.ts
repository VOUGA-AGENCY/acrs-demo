import type { NextConfig } from "next";
import path from "path";

const config: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: path.join(__dirname),
};

export default config;
