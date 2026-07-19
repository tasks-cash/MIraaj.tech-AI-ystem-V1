
# Encryption at rest

Sensitive fields use AES-256-GCM with envelope encryption.

`KeyManagementProvider` implementations:

- LocalDevelopmentKeyProvider
- EnvironmentKeyProvider
- AWS/GCP/Azure/Vault placeholders

Production must not use hardcoded master keys.
