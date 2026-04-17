import { Module } from '@nestjs/common';
import { ADMIN_ADAPTER, AdminModule, TypeOrmAdminAdapter } from 'nestjs-dj-admin';
import { dashboardLinkWidgetExtension } from 'nestjs-dj-admin/dashboard-link-widget-extension';
import { embedPageExtension } from 'nestjs-dj-admin/embed-page-extension';
import { verifyPassword } from './auth/password.js';
import { DataSource } from 'typeorm';
import { initializeDemoDataSource } from './database/demo-data.source.js';
import { DemoDataService } from './database/demo-data.service.js';
import { DemoTestController } from './database/demo-test.controller.js';
import { TypeOrmAdminAuditStore } from './modules/admin-audit/typeorm-admin-audit.store.js';
import { CategoryModule } from './modules/category/category.module.js';
import { OrderDetailModule } from './modules/order-detail/order-detail.module.js';
import { OrderModule } from './modules/order/order.module.js';
import { ProductModule } from './modules/product/product.module.js';
import { Role, User } from './modules/user/user.entity.js';
import { UserModule } from './modules/user/user.module.js';

const grafanaEmbedUrl = process.env['GRAFANA_EMBED_URL'] ?? 'http://127.0.0.1:3001/d-solo/dj-admin-overview/dj-admin-overview?orgId=1&from=now-6h&to=now&theme=dark&panelId=1';

@Module({
  imports: [
    CategoryModule,
    OrderDetailModule,
    OrderModule,
    ProductModule,
    UserModule,
    AdminModule.forRoot({
      path: '/admin',
      extensions: [
        embedPageExtension({
          id: 'grafana-page',
          page: {
            slug: 'grafana-overview',
            label: 'Grafana overview',
            category: 'Monitoring',
            title: 'Grafana Overview',
            description: 'Local Grafana dashboard running from the demo Docker stack.',
            url: grafanaEmbedUrl,
            height: 520,
          },
        }),
        dashboardLinkWidgetExtension({
          id: 'grafana-widget',
          title: 'Grafana overview',
          description: 'Open the embedded monitoring dashboard from the admin home screen.',
          ctaLabel: 'Open Grafana overview',
          pageSlug: 'grafana-overview',
        }),
      ],
      branding: {
        siteHeader: 'Northwind Admin',
        siteTitle: 'Northwind Admin',
        indexTitle: 'Northwind administration',
        accentColor: '#7aa37a',
      },
      display: {
        locale: 'en-US',
        dateFormat: {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        },
        dateTimeFormat: {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        },
      },
      auth: {
        authenticate: async ({ email, password }) => {
          const dataSource = await initializeDemoDataSource();

          const user = await dataSource.getRepository(User).findOne({
            where: { email },
          });

          if (!user || !user.active || user.role !== Role.ADMIN) {
            return null;
          }

          if (!verifyPassword(password, user.passwordHash)) {
            return null;
          }

          return {
            id: String(user.id),
            role: user.role,
            email: user.email,
          };
        },
      },
      auditLog: {
        enabled: true,
        store: new TypeOrmAdminAuditStore(() => initializeDemoDataSource()),
      },
    }),
  ],
  controllers: [DemoTestController],
  providers: [
    {
      provide: DataSource,
      useFactory: async () => {
        return initializeDemoDataSource();
      },
    },
    {
      provide: ADMIN_ADAPTER,
      useFactory: (dataSource: DataSource) => new TypeOrmAdminAdapter(dataSource),
      inject: [DataSource],
    },
    DemoDataService,
  ],
})
export class AppModule {}
