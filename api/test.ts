export default async function handler(req: any, res: any) {
  try {
    // Dynamically import the Express app bundle
    // @ts-ignore
    const appModule = await import("../artifacts/api-server/dist/app.cjs");
    res.status(200).json({
      status: "ok",
      message: "Express app imported successfully!",
      keys: Object.keys(appModule)
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message,
      stack: err.stack,
      code: err.code
    });
  }
}
