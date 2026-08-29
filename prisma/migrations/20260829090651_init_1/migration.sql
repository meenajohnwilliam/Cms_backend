-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'PENDING');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY', 'NONE');

-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('TEXT', 'EMAIL', 'NUMBER', 'TEXTAREA', 'SELECT', 'MULTI_SELECT', 'RADIO', 'CHECKBOX', 'DATE', 'TIME', 'DATETIME', 'PHONE', 'URL', 'FILE', 'IMAGE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'RICHTEXT', 'IMAGE', 'FILE', 'DATE', 'JSON');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Tenant" (
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "User" (
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationOtp" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),
    "emailVerificationOtpCreatedAt" TIMESTAMP(3),
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "tenantId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserProjectAccess" (
    "accessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProjectAccess_pkey" PRIMARY KEY ("accessId")
);

-- CreateTable
CREATE TABLE "Plan" (
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL DEFAULT 'PAID',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'NONE',
    "price" TEXT NOT NULL DEFAULT '0',
    "razorpayPlanId" TEXT,
    "projectLimit" INTEGER NOT NULL,
    "collectionLimit" INTEGER NOT NULL,
    "apiKeyLimit" INTEGER NOT NULL,
    "teamMemberLimit" INTEGER NOT NULL,
    "storageLimit" BIGINT NOT NULL,
    "getRequestsLimit" INTEGER NOT NULL,
    "writeRequestsLimit" INTEGER NOT NULL,
    "customDomain" BOOLEAN NOT NULL DEFAULT false,
    "mediaUpload" BOOLEAN NOT NULL DEFAULT false,
    "analytics" TEXT NOT NULL,
    "emailSupport" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("planId")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "subscriptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "razorpaySubscriptionId" TEXT,
    "razorpayCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("subscriptionId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "paymentId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "razorpayPaymentId" TEXT,
    "razorpayOrderId" TEXT,
    "razorpaySubscriptionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("paymentId")
);

-- CreateTable
CREATE TABLE "Project" (
    "projectId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "Collection" (
    "collectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CollectionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("collectionId")
);

-- CreateTable
CREATE TABLE "CollectionField" (
    "fieldId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionField_pkey" PRIMARY KEY ("fieldId")
);

-- CreateTable
CREATE TABLE "Record" (
    "recordId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("recordId")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "apiKeyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("apiKeyId")
);

-- CreateTable
CREATE TABLE "Form" (
    "formId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("formId")
);

-- CreateTable
CREATE TABLE "FormField" (
    "fieldId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FormFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "options" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("fieldId")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "submissionId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("submissionId")
);

-- CreateTable
CREATE TABLE "Media" (
    "mediaId" TEXT NOT NULL,
    "recordId" TEXT,
    "submissionId" TEXT,
    "fieldId" TEXT,
    "type" "FieldType" NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("mediaId")
);

-- CreateTable
CREATE TABLE "Usage" (
    "usageId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,
    "getRequestsUsed" INTEGER NOT NULL DEFAULT 0,
    "writeRequestsUsed" INTEGER NOT NULL DEFAULT 0,
    "apiKeysUsed" INTEGER NOT NULL DEFAULT 0,
    "projectsUsed" INTEGER NOT NULL DEFAULT 0,
    "collectionsUsed" INTEGER NOT NULL DEFAULT 0,
    "teamMembersUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usage_pkey" PRIMARY KEY ("usageId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetPasswordToken_key" ON "User"("resetPasswordToken");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE INDEX "UserProjectAccess_userId_idx" ON "UserProjectAccess"("userId");

-- CreateIndex
CREATE INDEX "UserProjectAccess_projectId_idx" ON "UserProjectAccess"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProjectAccess_userId_projectId_key" ON "UserProjectAccess"("userId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_razorpayPlanId_key" ON "Plan"("razorpayPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_razorpaySubscriptionId_key" ON "Subscription"("razorpaySubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_idx" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Subscription_tenantId_status_idx" ON "Subscription"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Project_tenantId_idx" ON "Project"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_tenantId_slug_key" ON "Project"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Collection_projectId_idx" ON "Collection"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_projectId_slug_key" ON "Collection"("projectId", "slug");

-- CreateIndex
CREATE INDEX "CollectionField_collectionId_idx" ON "CollectionField"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionField_collectionId_slug_key" ON "CollectionField"("collectionId", "slug");

-- CreateIndex
CREATE INDEX "Record_collectionId_idx" ON "Record"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_projectId_idx" ON "ApiKey"("projectId");

-- CreateIndex
CREATE INDEX "Form_projectId_idx" ON "Form"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Form_projectId_slug_key" ON "Form"("projectId", "slug");

-- CreateIndex
CREATE INDEX "FormField_formId_idx" ON "FormField"("formId");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_idx" ON "FormSubmission"("formId");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_createdAt_idx" ON "FormSubmission"("formId", "createdAt");

-- CreateIndex
CREATE INDEX "Media_recordId_idx" ON "Media"("recordId");

-- CreateIndex
CREATE INDEX "Media_fieldId_idx" ON "Media"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "Usage_tenantId_key" ON "Usage"("tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectAccess" ADD CONSTRAINT "UserProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectAccess" ADD CONSTRAINT "UserProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("planId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("subscriptionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionField" ADD CONSTRAINT "CollectionField_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("collectionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("collectionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("formId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("formId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("recordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("submissionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usage" ADD CONSTRAINT "Usage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
