# Local access

Kestrel defaults to HTTP on 127.0.0.1:5080 and [::1]:5080. The development launch profile uses the same addresses. Remote access requires a separate decision, authentication and HTTPS.

Compose publishes PostgreSQL only on host 127.0.0.1. Any future API port publication must also use host 127.0.0.1. Kestrel endpoint configuration takes precedence over the Docker image's URL environment variable. Container loopback binding cannot be reached through Docker bridge port forwarding; run the API on the host for local development.
