import path from 'path'

const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(process.cwd(), 'src'),
      '@/components': path.resolve(process.cwd(), 'src/components'),
      '@/lib': path.resolve(process.cwd(), 'src/lib'),
      '@/hooks': path.resolve(process.cwd(), 'src/hooks'),
      '@pitch/shared': path.resolve(process.cwd(), '../../packages/shared/src'),
    }
    // Required for onnxruntime-web WASM execution (used by @huggingface/transformers)
    config.experiments = { ...config.experiments, asyncWebAssembly: true }
    return config
  },
}

export default nextConfig
