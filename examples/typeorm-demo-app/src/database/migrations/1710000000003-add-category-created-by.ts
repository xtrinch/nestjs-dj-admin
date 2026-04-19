import {
  type MigrationInterface,
  type QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddCategoryCreatedBy1710000000003 implements MigrationInterface {
  name = 'AddCategoryCreatedBy1710000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('categories');
    if (!table) {
      return;
    }

    const hasColumn = table.columns.some((column) => column.name === 'createdById');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'categories',
        new TableColumn({
          name: 'createdById',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    await queryRunner.query(`
      UPDATE "categories"
      SET "createdById" = (
        SELECT "id"
        FROM "users"
        ORDER BY "id" ASC
        LIMIT 1
      )
      WHERE "createdById" IS NULL
    `);

    const updatedTable = await queryRunner.getTable('categories');
    if (!updatedTable) {
      return;
    }

    const hasIndex = updatedTable.indices.some((index) => index.name === 'IDX_categories_createdById');
    if (!hasIndex) {
      await queryRunner.createIndex(
        'categories',
        new TableIndex({
          name: 'IDX_categories_createdById',
          columnNames: ['createdById'],
        }),
      );
    }

    const hasForeignKey = updatedTable.foreignKeys.some((foreignKey) =>
      foreignKey.columnNames.length === 1
      && foreignKey.columnNames[0] === 'createdById',
    );
    if (!hasForeignKey) {
      await queryRunner.createForeignKey(
        'categories',
        new TableForeignKey({
          columnNames: ['createdById'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
        }),
      );
    }

    const hasNulls = await queryRunner.query(
      'SELECT EXISTS(SELECT 1 FROM "categories" WHERE "createdById" IS NULL) AS "exists"',
    ) as Array<{ exists: boolean }>;

    if (!hasNulls[0]?.exists) {
      await queryRunner.changeColumn(
        'categories',
        'createdById',
        new TableColumn({
          name: 'createdById',
          type: 'int',
          isNullable: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('categories');
    if (!table) {
      return;
    }

    const foreignKey = table.foreignKeys.find((candidate) =>
      candidate.columnNames.length === 1
      && candidate.columnNames[0] === 'createdById',
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('categories', foreignKey);
    }

    const index = table.indices.find((candidate) => candidate.name === 'IDX_categories_createdById');
    if (index) {
      await queryRunner.dropIndex('categories', index);
    }

    const hasColumn = table.columns.some((column) => column.name === 'createdById');
    if (hasColumn) {
      await queryRunner.dropColumn('categories', 'createdById');
    }
  }
}
