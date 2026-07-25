export function canvasSettingsUrl(publicBaseUrl?: string, serverBaseUrl?: string): string | null {
  const baseUrl = publicBaseUrl ?? serverBaseUrl;
  return baseUrl ? `${baseUrl.replace(/\/$/, "")}/profile/settings` : null;
}
