export default function handler(req: any, res: any) {
  res.status(200).json({
    status: "ok",
    vercel: true,
    timestamp: new Date().toISOString()
  });
}
