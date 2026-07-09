# ============================================================
# EADD Azure Infrastructure Module
# Platform Abstraction: Storage (ADLS), Processing (ADF/Synapse),
#   Query (Synapse SQL), Orchestration (ADF Pipelines)
# ============================================================

variable "environment" { type = string }
variable "project" { type = string; default = "eadd" }
variable "location" { type = string; default = "eastus" }

locals {
  prefix = "${var.project}-${var.environment}"
  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Platform    = "azure"
  }
}

# ─── Resource Group ─────────────────────────────────────
resource "azurerm_resource_group" "main" {
  name     = "${local.prefix}-rg"
  location = var.location
  tags     = local.tags
}

# ─── Storage Layer: ADLS Gen2 ───────────────────────────
resource "azurerm_storage_account" "data_lake" {
  name                     = replace("${local.prefix}lake", "-", "")
  resource_group_name      = azurerm_resource_group.main.name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  is_hns_enabled           = true # Hierarchical namespace for ADLS Gen2
  tags                     = local.tags
}

resource "azurerm_storage_data_lake_gen2_filesystem" "bronze" {
  name               = "bronze"
  storage_account_id = azurerm_storage_account.data_lake.id
}

resource "azurerm_storage_data_lake_gen2_filesystem" "silver" {
  name               = "silver"
  storage_account_id = azurerm_storage_account.data_lake.id
}

resource "azurerm_storage_data_lake_gen2_filesystem" "gold" {
  name               = "gold"
  storage_account_id = azurerm_storage_account.data_lake.id
}

# ─── Processing/Orchestration: Data Factory ─────────────
resource "azurerm_data_factory" "main" {
  name                = "${local.prefix}-adf"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags

  identity {
    type = "SystemAssigned"
  }
}

# ─── Query Layer: Key Vault (secrets) ───────────────────
resource "azurerm_key_vault" "main" {
  name                = replace("${local.prefix}-kv", "-", "")
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
  tags                = local.tags
}

data "azurerm_client_config" "current" {}

# ─── Outputs ────────────────────────────────────────────
output "resource_group_name" { value = azurerm_resource_group.main.name }
output "storage_account_name" { value = azurerm_storage_account.data_lake.name }
output "data_factory_name" { value = azurerm_data_factory.main.name }
output "key_vault_name" { value = azurerm_key_vault.main.name }
