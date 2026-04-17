import { Injectable, Module } from '@nestjs/common';
import {
  AdminModule,
  AdminResource,
  InMemoryAdminAdapter,
  adminSchemaFromClassValidator,
} from 'nestjs-dj-admin';
import { dashboardLinkWidgetExtension } from 'nestjs-dj-admin/dashboard-link-widget-extension';
import { embedPageExtension } from 'nestjs-dj-admin/embed-page-extension';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

const dashboardPreviewHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Built Consumer Dashboard</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        font-family: ui-sans-serif, system-ui, sans-serif;
        background: linear-gradient(180deg, #111827 0%, #0f172a 100%);
        color: #e5e7eb;
        padding: 24px;
      }
      .wrap {
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 16px;
        padding: 24px;
        background: rgba(15, 23, 42, 0.84);
      }
      .eyebrow {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: #f59e0b;
      }
      h1 {
        margin: 8px 0 12px;
      }
      p {
        margin: 0;
        color: #94a3b8;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="eyebrow">Monitoring</div>
      <h1>Built Consumer Demo</h1>
      <p>This admin runs against the built package exports and loads an embed extension.</p>
    </div>
  </body>
</html>
`;

const dashboardPreviewUrl = `data:text/html;charset=utf-8,${encodeURIComponent(dashboardPreviewHtml)}`;

class User {}

class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  role!: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

@Injectable()
@AdminResource({
  model: User,
  resourceName: 'users',
  objectLabel: 'email',
  list: ['id', 'email', 'role', 'active'],
  search: ['email', 'role'],
  permissions: {
    read: ['admin'],
    write: ['admin'],
  },
  schema: adminSchemaFromClassValidator({
    createDto: CreateUserDto,
    updateDto: UpdateUserDto,
  }),
})
class BuiltConsumerUserAdmin {}

@Module({
  imports: [
    AdminModule.forRoot({
      path: '/admin',
      adapter: InMemoryAdminAdapter,
      extensions: [
        embedPageExtension({
          id: 'built-consumer-monitoring-page',
          page: {
            slug: 'consumer-monitoring',
            label: 'Consumer monitoring',
            category: 'Monitoring',
            title: 'Consumer Monitoring',
            description: 'Extension page registered through the built package.',
            url: dashboardPreviewUrl,
            height: 420,
          },
        }),
        dashboardLinkWidgetExtension({
          id: 'built-consumer-monitoring-widget',
          title: 'Consumer monitoring',
          description: 'Open the built-consumer monitoring page.',
          pageSlug: 'consumer-monitoring',
        }),
      ],
      auth: {
        authenticate: async ({ email, password }) => {
          if (email !== 'ada@example.com' || password !== 'admin123') {
            return null;
          }

          return {
            id: '1',
            role: 'admin',
            email,
          };
        },
      },
      auditLog: {
        enabled: true,
      },
    }),
  ],
  providers: [BuiltConsumerUserAdmin],
})
export class AppModule {}
