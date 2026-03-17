import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import * as dotenv from "dotenv";
import passport from "passport";
import { AppExceptionFilter } from "./common/filters/app-exception.filter";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = (
    process.env.CORS_ORIGINS ||
    "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.use(passport.initialize());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields from request bodies
      transform: true, // auto-coerce query/param primitives to declared types
    }),
  );
  app.useGlobalFilters(new AppExceptionFilter());

  // Swagger — interactive API docs at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Triolith Wallet API")
    .setDescription("Backend API for the Triolith wallet system")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
