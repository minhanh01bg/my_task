export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const sharp = (await import("sharp")).default;
      sharp.cache(false);
    } catch {
      // sharp might not be loaded in all runtime contexts
    }
  }
}
