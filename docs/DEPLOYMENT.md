# E-Commerce 3-Tier Application - Kubernetes Deployment Guide

## Architecture Overview

This is a production-ready 3-tier microservices application:

### **Tier 1: Frontend**
- React SPA with modern UI
- Nginx web server
- 3 replicas with load balancing

### **Tier 2: Backend Microservices**
- **Products Service**: Manages product catalog (Node.js/Express)
- **Orders Service**: Handles order processing (Node.js/Express)
- **API Gateway**: NGINX reverse proxy for routing
- 2 replicas per service with horizontal auto-scaling

### **Tier 3: Database**
- PostgreSQL 15
- Persistent storage with 1GB volume
- Single instance (suitable for small DB requirement)

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- Docker registry access (Docker Hub, ECR, GCR, etc.)
- At least 2GB RAM and 2 CPU cores available

## Project Structure

```
ecommerce-k8s/
├── frontend/
│   ├── src/
│   │   └── App.js
│   ├── public/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── products-service/
│   ├── index.js
│   ├── Dockerfile
│   └── package.json
├── orders-service/
│   ├── index.js
│   ├── Dockerfile
│   └── package.json
└── kubernetes/
    ├── namespace.yaml
    ├── postgres-*.yaml
    ├── products-*.yaml
    ├── orders-*.yaml
    ├── frontend-*.yaml
    ├── api-gateway-*.yaml
    └── hpa-*.yaml
```

## Step 1: Build and Push Docker Images

### 1.1 Build Products Service
```bash
cd products-service
docker build -t your-registry/products-service:latest .
docker push your-registry/products-service:latest
```

### 1.2 Build Orders Service
```bash
cd ../orders-service
docker build -t your-registry/orders-service:latest .
docker push your-registry/orders-service:latest
```

### 1.3 Build Frontend
```bash
cd ../frontend
docker build -t your-registry/frontend:latest .
docker push your-registry/frontend:latest
```

**Note:** Replace `your-registry` with your actual Docker registry (e.g., `docker.io/username`, `gcr.io/project-id`)

## Step 2: Update Kubernetes Configurations

Update image references in the deployment files:
- `kubernetes/products-deployment.yaml`
- `kubernetes/orders-deployment.yaml`
- `kubernetes/frontend-deployment.yaml`

Replace `your-registry` with your actual registry path.

## Step 3: Deploy to Kubernetes

### 3.1 Create Namespace
```bash
kubectl apply -f kubernetes/namespace.yaml
```

### 3.2 Deploy Database Layer
```bash
kubectl apply -f kubernetes/postgres-configmap.yaml
kubectl apply -f kubernetes/postgres-secret.yaml
kubectl apply -f kubernetes/postgres-pvc.yaml
kubectl apply -f kubernetes/postgres-deployment.yaml
kubectl apply -f kubernetes/postgres-service.yaml
```

Wait for PostgreSQL to be ready:
```bash
kubectl wait --for=condition=ready pod -l app=postgres -n ecommerce --timeout=120s
```

### 3.3 Deploy Backend Services
```bash
kubectl apply -f kubernetes/products-deployment.yaml
kubectl apply -f kubernetes/products-service.yaml

kubectl apply -f kubernetes/orders-deployment.yaml
kubectl apply -f kubernetes/orders-service.yaml
```

Wait for services to be ready:
```bash
kubectl wait --for=condition=ready pod -l app=products-service -n ecommerce --timeout=120s
kubectl wait --for=condition=ready pod -l app=orders-service -n ecommerce --timeout=120s
```

### 3.4 Deploy API Gateway
```bash
kubectl apply -f kubernetes/api-gateway-configmap.yaml
kubectl apply -f kubernetes/api-gateway-deployment.yaml
kubectl apply -f kubernetes/api-gateway-service.yaml
```

### 3.5 Deploy Frontend
```bash
kubectl apply -f kubernetes/frontend-deployment.yaml
kubectl apply -f kubernetes/frontend-service.yaml
```

### 3.6 Enable Auto-scaling (Optional)
```bash
kubectl apply -f kubernetes/hpa-products.yaml
kubectl apply -f kubernetes/hpa-orders.yaml
```

## Step 4: Verify Deployment

### Check all pods are running
```bash
kubectl get pods -n ecommerce
```

Expected output:
```
NAME                               READY   STATUS    RESTARTS   AGE
postgres-xxxxx                     1/1     Running   0          2m
products-service-xxxxx             1/1     Running   0          1m
products-service-yyyyy             1/1     Running   0          1m
orders-service-xxxxx               1/1     Running   0          1m
orders-service-yyyyy               1/1     Running   0          1m
api-gateway-xxxxx                  1/1     Running   0          1m
api-gateway-yyyyy                  1/1     Running   0          1m
frontend-xxxxx                     1/1     Running   0          1m
frontend-yyyyy                     1/1     Running   0          1m
frontend-zzzzz                     1/1     Running   0          1m
```

### Check services
```bash
kubectl get svc -n ecommerce
```

### Get frontend URL
```bash
kubectl get svc frontend-service -n ecommerce
```

For LoadBalancer, wait for EXTERNAL-IP to be assigned. For NodePort or on Minikube:
```bash
minikube service frontend-service -n ecommerce --url
```

## Step 5: Test the Application

### Access the frontend
Open the EXTERNAL-IP or service URL in your browser.

### Test APIs directly
```bash
# Port-forward API gateway
kubectl port-forward -n ecommerce svc/api-gateway 8080:80

# Test products endpoint
curl http://localhost:8080/products

# Test orders endpoint
curl http://localhost:8080/orders
```

## Monitoring and Management

### View logs
```bash
# Products service logs
kubectl logs -f -l app=products-service -n ecommerce

# Orders service logs
kubectl logs -f -l app=orders-service -n ecommerce

# Frontend logs
kubectl logs -f -l app=frontend -n ecommerce
```

### Check resource usage
```bash
kubectl top pods -n ecommerce
```

### Scale manually
```bash
kubectl scale deployment products-service -n ecommerce --replicas=5
```

### Access database
```bash
kubectl exec -it -n ecommerce deployment/postgres -- psql -U postgres -d ecommerce

# View products
SELECT * FROM products;

# View orders
SELECT * FROM orders;
```

## Production Considerations

### Security
1. **Update secrets**: Change default PostgreSQL password
   ```bash
   kubectl create secret generic postgres-secret \
     --from-literal=POSTGRES_PASSWORD=your-strong-password \
     -n ecommerce --dry-run=client -o yaml | kubectl apply -f -
   ```

2. **Enable TLS**: Add ingress with TLS certificates
3. **Network policies**: Restrict pod-to-pod communication
4. **RBAC**: Configure role-based access control

### High Availability
1. **Multi-zone deployment**: Spread pods across availability zones
2. **Database replication**: Use PostgreSQL streaming replication or managed DB service
3. **Backup strategy**: Implement automated backups for persistent volumes

### Performance
1. **Resource limits**: Tune CPU/memory based on load testing
2. **Connection pooling**: Implement PgBouncer for database connections
3. **Caching**: Add Redis for frequently accessed data
4. **CDN**: Use CDN for frontend static assets

### Observability
1. **Metrics**: Deploy Prometheus and Grafana
   ```bash
   helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring
   ```

2. **Logging**: Use ELK/EFK stack or cloud-native solutions
3. **Tracing**: Implement distributed tracing with Jaeger or Zipkin
4. **Alerts**: Configure AlertManager for critical events

## Cleanup

To remove the entire application:
```bash
kubectl delete namespace ecommerce
```

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name> -n ecommerce
```

### Database connection issues
1. Verify PostgreSQL is running
2. Check service DNS resolution
3. Validate credentials in secrets

### Service communication issues
```bash
# Test connectivity from one pod to another
kubectl exec -it -n ecommerce deployment/products-service -- wget -O- http://postgres-service:5432
```

### Performance issues
1. Check HPA status: `kubectl get hpa -n ecommerce`
2. Monitor metrics: `kubectl top pods -n ecommerce`
3. Review logs for errors

## Next Steps

1. **CI/CD**: Set up GitHub Actions, GitLab CI, or Jenkins
2. **Helm Charts**: Package application as Helm chart for easier deployment
3. **Service Mesh**: Consider Istio or Linkerd for advanced traffic management
4. **Managed Services**: Migrate database to managed PostgreSQL (RDS, Cloud SQL)
5. **Multi-environment**: Create dev, staging, and production namespaces

## Support

For issues or questions:
- Check pod logs: `kubectl logs <pod-name> -n ecommerce`
- Review Kubernetes events: `kubectl get events -n ecommerce`
- Inspect resource status: `kubectl describe <resource> <name> -n ecommerce`
