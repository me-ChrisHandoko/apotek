/*
  Warnings:

  - You are about to drop the column `quantity` on the `ProductBatch` table. All the data in the column will be lost.
  - You are about to drop the column `expectedDate` on the `PurchaseOrder` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `PurchaseOrder` table. All the data in the column will be lost.
  - Added the required column `currentQuantity` to the `ProductBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `initialQuantity` to the `ProductBatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalCost` to the `PurchaseOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `PurchaseOrder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductBatch" DROP COLUMN "quantity",
ADD COLUMN     "currentQuantity" INTEGER NOT NULL,
ADD COLUMN     "initialQuantity" INTEGER NOT NULL,
ADD COLUMN     "manufacturingDate" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" DROP COLUMN "expectedDate",
DROP COLUMN "total",
ADD COLUMN     "expectedDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "receivedDate" TIMESTAMP(3),
ADD COLUMN     "totalCost" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_userId_idx" ON "PurchaseOrder"("userId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
