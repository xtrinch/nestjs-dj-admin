import { type MigrationInterface, type QueryRunner, TableColumn } from 'typeorm';

export class AddSoftDeleteToProducts1710000000001 implements MigrationInterface {
  name = 'AddSoftDeleteToProducts1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'deletedAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('products', 'deletedAt');
  }
}
