import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import * as dotenv from "dotenv";
import passport from "passport";
import { AppExceptionFilter } from "./common/filters/app-exception.filter";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = (
    process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5174"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.use(passport.initialize());
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new AppExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
