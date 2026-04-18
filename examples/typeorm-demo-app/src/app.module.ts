import { Module } from '@nestjs/common';
import { ADMIN_ADAPTER } from '#src/admin/admin.constants.js';
import { TypeOrmAdminAdapter } from '#src/admin/adapters/typeorm.adapter.js';
import { AdminModule } from '#src/admin/admin.module.js';
import { adminSchemaFromZod } from '#src/admin/schema/zod-schema.provider.js';
import { dashboardLinkWidgetExtension } from '#src/extensions/dashboard-link-widget/index.js';
import { bullmqQueueExtension } from '#src/extensions/bullmq-queue/index.js';
import { embedPageExtension } from '#src/extensions/embed/index.js';
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
import { DEMO_PERMISSIONS, permissionsForDemoRole } from '../../shared/src/admin-permissions.js';
import { demoBullMqQueueAdapter } from './queues/demo-bullmq.js';
import { DemoQueueService } from './queues/demo-queue.service.js';
import { z } from 'zod';

const grafanaEmbedUrl = process.env['GRAFANA_EMBED_URL'] ?? 'http://127.0.0.1:3001/d-solo/dj-admin-overview/dj-admin-overview?orgId=1&from=now-6h&to=now&theme=dark&panelId=1';
const emailQueuePayloadSchema = adminSchemaFromZod({
  display: z.object({
    userId: z.coerce.number(),
    orderId: z.coerce.number().optional(),
    orderNumber: z.string().optional(),
    template: z.string(),
  }),
  fields: {
    userId: { label: 'User' },
    orderId: { label: 'Order' },
    orderNumber: { label: 'Order number' },
    template: { label: 'Template' },
  },
});
const webhookQueuePayloadSchema = adminSchemaFromZod({
  display: z.object({
    orderId: z.coerce.number().optional(),
    orderNumber: z.string().optional(),
    target: z.string(),
  }),
  fields: {
    orderId: { label: 'Order' },
    orderNumber: { label: 'Order number' },
    target: { label: 'Target' },
  },
});
const importQueuePayloadSchema = adminSchemaFromZod({
  display: z.object({
    source: z.string(),
  }),
  fields: {
    source: { label: 'Source' },
  },
});

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
        dashboardLinkWidgetExtension({
          id: 'queues-widget',
          title: 'Queues',
          description: 'Inspect queue health, backlog, and recent jobs across configured queues.',
          ctaLabel: 'Open queue overview',
          pageSlug: 'queues-overview',
        }),
        bullmqQueueExtension({
          adapter: demoBullMqQueueAdapter,
          queues: [
            {
              key: 'email',
              label: 'Email',
              description: 'Transactional messages waiting for SMTP delivery.',
              payloadSchema: emailQueuePayloadSchema,
              filters: ['userId', 'orderId', 'orderNumber', 'template'],
              list: ['userId', 'template', 'orderNumber'],
            },
            {
              key: 'webhooks',
              label: 'Webhooks',
              description: 'Outbound partner webhook fanout and retries.',
              payloadSchema: webhookQueuePayloadSchema,
              filters: ['orderId', 'orderNumber', 'target'],
              list: ['target', 'orderNumber'],
            },
            {
              key: 'imports',
              label: 'Imports',
              description: 'Nightly ingest and reconciliation jobs.',
              payloadSchema: importQueuePayloadSchema,
              filters: ['source'],
              list: ['source'],
            },
          ],
          recordPanels: [
            {
              resource: 'orders',
              title: 'Related queue jobs',
              links: [
                { queueKey: 'email', filterKey: 'orderNumber', recordField: 'number', label: 'Email jobs' },
                { queueKey: 'webhooks', filterKey: 'orderNumber', recordField: 'number', label: 'Webhook jobs' },
              ],
            },
          ],
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

          if (!user || !user.active) {
            return null;
          }

          if (!verifyPassword(password, user.passwordHash)) {
            return null;
          }

          return {
            id: String(user.id),
            permissions: permissionsForDemoRole(user.role),
            email: user.email,
            isSuperuser: user.role === Role.ADMIN,
          };
        },
      },
      auditLog: {
        enabled: true,
        permissions: {
          read: [DEMO_PERMISSIONS.audit.read],
        },
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
    DemoQueueService,
  ],
})
export class AppModule {}
