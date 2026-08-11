import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3000);

createApp().listen(port, () => {
  console.log(`API 서버 실행 중 → http://localhost:${port}`);
});
