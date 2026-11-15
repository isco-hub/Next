terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "nextcrop-terraform-state"
    key    = "nextcrop/terraform.tfstate"
    region = "af-south-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# ── Variables ────────────────────────────────────────────────────────────────

variable "aws_region" {
  default = "af-south-1"  # Cape Town — lowest latency to Uganda
}

variable "environment" {
  description = "development | staging | production"
  type        = string
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "Application SECRET_KEY"
  type        = string
  sensitive   = true
}

variable "msisdn_pepper" {
  description = "MSISDN HMAC pepper"
  type        = string
  sensitive   = true
}

# ── Networking ───────────────────────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = { Name = "nextcrop-${var.environment}" }
}

resource "aws_subnet" "public_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.aws_region}a"
  tags = { Name = "nextcrop-public-a" }
}

resource "aws_subnet" "public_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.aws_region}b"
  tags = { Name = "nextcrop-public-b" }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "${var.aws_region}a"
  tags = { Name = "nextcrop-private-a" }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "${var.aws_region}b"
  tags = { Name = "nextcrop-private-b" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
}

# ── Secret Manager ───────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "nextcrop/${var.environment}/app"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    SECRET_KEY    = var.secret_key
    MSISDN_PEPPER = var.msisdn_pepper
    DB_PASSWORD   = var.db_password
  })
}

# ── RDS PostgreSQL with PostGIS ───────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "nextcrop-${var.environment}"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

resource "aws_db_instance" "postgres" {
  identifier              = "nextcrop-${var.environment}"
  engine                  = "postgres"
  engine_version          = "16.2"
  instance_class          = var.environment == "production" ? "db.t3.medium" : "db.t3.micro"
  allocated_storage       = 20
  max_allocated_storage   = 100
  db_name                 = "nextcrop"
  username                = "nextcrop"
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  multi_az                = var.environment == "production"
  backup_retention_period = 7
  deletion_protection     = var.environment == "production"
  storage_encrypted       = true
  skip_final_snapshot     = var.environment != "production"

  tags = { Environment = var.environment }
}

# ── ElastiCache Redis ─────────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name       = "nextcrop-${var.environment}"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "nextcrop-${var.environment}"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  tags = { Environment = var.environment }
}

# ── ECR Container Registry ────────────────────────────────────────────────────

resource "aws_ecr_repository" "api" {
  name                 = "nextcrop-api"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

# ── ECS Cluster ───────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "nextcrop-${var.environment}"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "db_endpoint" {
  value     = aws_db_instance.postgres.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}
