type PrismaDbMode = 'accelerate' | 'cloud' | 'docker' | 'local' | 'direct';

const isAccelerateUrl = (url?: string): boolean =>
  Boolean(url && (url.startsWith('prisma://') || url.startsWith('prisma+')));

const normalizeDbMode = (mode?: string): PrismaDbMode | undefined => {
  if (!mode) return undefined;
  const normalized = mode.trim().toLowerCase();

  if (
    normalized === 'accelerate' ||
    normalized === 'cloud' ||
    normalized === 'docker' ||
    normalized === 'local' ||
    normalized === 'direct'
  ) {
    return normalized as PrismaDbMode;
  }

  return undefined;
};

export type PrismaRuntimeConfig = {
  url?: string;
  useAccelerate: boolean;
};

export const resolvePrismaRuntimeConfig = (
  accelerateUrl?: string,
  directUrl?: string,
): PrismaRuntimeConfig => {
  const mode = normalizeDbMode(process.env.PRISMA_DB_MODE);
  const useDirect = mode === 'docker' || mode === 'local' || mode === 'direct';
  const url = useDirect
    ? (directUrl ?? accelerateUrl)
    : (accelerateUrl ?? directUrl);
  const useAccelerate = isAccelerateUrl(url);

  return { url, useAccelerate };
};
