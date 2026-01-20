# Complete Manual Deployment Guide

## Prerequisites Setup

### 1. Install Required Tools

**On Ubuntu/Debian:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Minikube (for local testing)
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
```

**On macOS:**
```bash
# Install Docker Desktop from https://www.docker.com/products/docker-desktop

# Install kubectl
brew install kubectl

# Install Minikube
brew install minikube
```

**On Windows:**
```powershell
# Install Docker Desktop from https://www.docker.com/products/docker-desktop
# Install kubectl using Chocolatey
choco install kubernetes-cli

# Install Minikube
choco install minikube
```

### 2. Start Kubernetes Cluster

**Using Minikube (Local):**
```bash
# Start Minikube with sufficient resources
minikube start --cpus=4 --memory=4096 --driver=docker

# Enable metrics server for HPA
minikube addons enable metrics-server

# Verify cluster is running
kubectl cluster-info
```

**Using Cloud Provider:**
- **GKE:** `gcloud container clusters create ecommerce-cluster --num-nodes=3`
- **EKS:** Use AWS Console or eksctl
- **AKS:** `az aks create --resource-group myResourceGroup --name ecommerce-cluster`

---

## File Structure Setup

### 3. Create Project Directory Structure

```bash
mkdir -p ecommerce-k8s
cd ecommerce-k8s

# Create service directories
mkdir -p frontend/src frontend/public
mkdir -p products-service
mkdir -p orders-service
mkdir -p kubernetes
```

### 4. Create Service Files

**Create `products-service/index.js`** - Copy from the "Products Microservice" artifact

**Create `products-service/package.json`:**
```json
{
  "name": "products-service",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "cors": "^2.8.5"
  }
}
```

**Create `products-service/Dockerfile`:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
```

**Create `orders-service/index.js`** - Copy from the "Orders Microservice" artifact

**Create `orders-service/package.json`:**
```json
{
  "name": "orders-service",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "cors": "^2.8.5",
    "axios": "^1.6.2"
  }
}
```

**Create `orders-service/Dockerfile`:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3002
CMD ["node", "index.js"]
```

**Create `frontend/src/App.js`** - Copy from the "E-Commerce Frontend" artifact

**Create `frontend/package.json`:**
```json
{
  "name": "ecommerce-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "lucide-react": "^0.263.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version"]
  }
}
```

**Create `frontend/public/index.html`:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>E-Commerce Platform</title>
</head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
</body>
</html>
```

**Create `frontend/src/index.js`:**
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

**Create `frontend/Dockerfile`:**
```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Create `frontend/nginx.conf`:**
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 5. Create Kubernetes Manifests

Create all YAML files in the `kubernetes/` directory - Copy from "Kubernetes Deployment Configs" artifact.

Split into individual files:
- `namespace.yaml`
- `postgres-configmap.yaml`
- `postgres-secret.yaml`
- `postgres-pvc.yaml`
- `postgres-deployment.yaml`
- `postgres-service.yaml`
- `products-deployment.yaml`
- `products-service.yaml`
- `orders-deployment.yaml`
- `orders-service.yaml`
- `api-gateway-configmap.yaml`
- `api-gateway-deployment.yaml`
- `api-gateway-service.yaml`
- `frontend-deployment.yaml`
- `frontend-service.yaml`
- `hpa-products.yaml`
- `hpa-orders.yaml`

---

## Build and Push Images

### 6. Build Docker Images

```Before this Make sure you have  installed npm Package And and installed npm install
apt/npm install npm
node -v  # Check Node.js version
npm -v   # Check npm version
npm install
s -l /projects/ecommerce-k8s/"yourfile name"/package-lock.json


```bash
# Build products service
cd products-service
docker build -t yourusername/products-service:latest .
cd ..

# Build orders service
cd orders-service
docker build -t yourusername/orders-service:latest .
cd ..

# Build frontend
cd frontend
docker build -t yourusername/frontend:latest .
cd ..
```

### 7. Push to Docker Registry

```bash
# Login to Docker Hub (or your registry)
docker login

# Push images
docker push yourusername/products-service:latest
docker push yourusername/orders-service:latest
docker push yourusername/frontend:latest
```

**Note:** Replace `yourusername` with your Docker Hub username

### 8. Update Kubernetes Manifests

Edit the following files and replace `your-registry` with your actual registry:

```bash
# Update products-deployment.yaml
sed -i 's|your-registry|yourusername|g' kubernetes/products-deployment.yaml

# Update orders-deployment.yaml
sed -i 's|your-registry|yourusername|g' kubernetes/orders-deployment.yaml

# Update frontend-deployment.yaml
sed -i 's|your-registry|yourusername|g' kubernetes/frontend-deployment.yaml
```

---

## Deploy to Kubernetes

### 9. Deploy Database Layer

```bash
# Create namespace
kubectl apply -f kubernetes/namespace.yaml

# Deploy PostgreSQL
kubectl apply -f kubernetes/postgres-configmap.yaml
kubectl apply -f kubernetes/postgres-secret.yaml
kubectl apply -f kubernetes/postgres-pvc.yaml
kubectl apply -f kubernetes/postgres-deployment.yaml
kubectl apply -f kubernetes/postgres-service.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n ecommerce --timeout=180s

# Verify
kubectl get pods -n ecommerce
```

### 10. Deploy Backend Services

```bash
# Deploy Products Service
kubectl apply -f kubernetes/products-deployment.yaml
kubectl apply -f kubernetes/products-service.yaml

# Deploy Orders Service
kubectl apply -f kubernetes/orders-deployment.yaml
kubectl apply -f kubernetes/orders-service.yaml

# Wait for services to be ready
kubectl wait --for=condition=ready pod -l app=products-service -n ecommerce --timeout=180s
kubectl wait --for=condition=ready pod -l app=orders-service -n ecommerce --timeout=180s

# Verify
kubectl get pods -n ecommerce
kubectl get svc -n ecommerce
```

### 11. Deploy API Gateway

```bash
kubectl apply -f kubernetes/api-gateway-configmap.yaml
kubectl apply -f kubernetes/api-gateway-deployment.yaml
kubectl apply -f kubernetes/api-gateway-service.yaml

# Verify
kubectl get pods -n ecommerce
```

### 12. Deploy Frontend

```bash
kubectl apply -f kubernetes/frontend-deployment.yaml
kubectl apply -f kubernetes/frontend-service.yaml

# Wait for frontend to be ready
kubectl wait --for=condition=ready pod -l app=frontend -n ecommerce --timeout=180s

# Verify
kubectl get pods -n ecommerce
kubectl get svc -n ecommerce
```

### 13. Deploy Auto-Scaling (Optional)

```bash
kubectl apply -f kubernetes/hpa-products.yaml
kubectl apply -f kubernetes/hpa-orders.yaml

# Verify HPA
kubectl get hpa -n ecommerce
```

---

## Access the Application

### 14. Get Application URL

**For Minikube:**
```bash
# Get the URL
minikube service frontend-service -n ecommerce --url

# Or use port-forwarding
kubectl port-forward -n ecommerce svc/frontend-service 8080:80
# Then open: http://localhost:8080
```

**For Cloud Provider with LoadBalancer:**
```bash
# Get external IP
kubectl get svc frontend-service -n ecommerce

# Wait for EXTERNAL-IP to appear (may take 2-5 minutes)
# Then access: http://<EXTERNAL-IP>
```

**For NodePort:**
```bash
# Get node IP and port
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}')
NODE_PORT=$(kubectl get svc frontend-service -n ecommerce -o jsonpath='{.spec.ports[0].nodePort}')

echo "Application URL: http://${NODE_IP}:${NODE_PORT}"
```

---

## Verify and Test

### 15. Test APIs Directly

```bash
# Port-forward to API gateway
kubectl port-forward -n ecommerce svc/api-gateway 8080:80

# Test in another terminal
curl http://localhost:8080/products
curl http://localhost:8080/orders

# Create an order
curl -X POST http://localhost:8080/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"product_id": 1, "quantity": 2, "price": 1299.99}
    ]
  }'
```

### 16. Check Logs

```bash
# View all pods
kubectl get pods -n ecommerce

# Check products service logs
kubectl logs -f -l app=products-service -n ecommerce

# Check orders service logs
kubectl logs -f -l app=orders-service -n ecommerce

# Check database logs
kubectl logs -f -l app=postgres -n ecommerce
```

### 17. Verify Database

```bash
# Connect to PostgreSQL
kubectl exec -it -n ecommerce deployment/postgres -- psql -U postgres -d ecommerce

# Run SQL queries
SELECT * FROM products;
SELECT * FROM orders;
\q
```

---

## Monitoring and Maintenance

### 18. Monitor Resources

```bash
# Check resource usage
kubectl top pods -n ecommerce
kubectl top nodes

# Check HPA status
kubectl get hpa -n ecommerce

# Watch pod status
kubectl get pods -n ecommerce -w
```

### 19. Scale Services

```bash
# Manual scaling
kubectl scale deployment products-service -n ecommerce --replicas=5

# Check scaling
kubectl get pods -n ecommerce
```

---

## Troubleshooting

### Common Issues and Solutions

**Pods not starting:**
```bash
kubectl describe pod <pod-name> -n ecommerce
kubectl logs <pod-name> -n ecommerce
```

**Image pull errors:**
```bash
# Verify image exists
docker pull yourusername/products-service:latest

# Check imagePullPolicy in deployment
kubectl get deployment products-service -n ecommerce -o yaml | grep imagePullPolicy
```

**Database connection issues:**
```bash
# Test connectivity from service pod
kubectl exec -it -n ecommerce deployment/products-service -- wget -O- http://postgres-service:5432

# Check service endpoints
kubectl get endpoints -n ecommerce
```

**LoadBalancer pending:**
```bash
# On Minikube, use tunnel
minikube tunnel

# Or switch to NodePort
kubectl patch svc frontend-service -n ecommerce -p '{"spec":{"type":"NodePort"}}'
```

---

## Cleanup

### 20. Remove Application

```bash
# Delete entire namespace
kubectl delete namespace ecommerce

# Or delete individual resources
kubectl delete -f kubernetes/

# Stop Minikube (if using)
minikube stop
minikube delete
```

---

## Quick Reference Commands

```bash
# View everything in namespace
kubectl get all -n ecommerce

# Restart a deployment
kubectl rollout restart deployment/products-service -n ecommerce

# Check deployment status
kubectl rollout status deployment/products-service -n ecommerce

# View events
kubectl get events -n ecommerce --sort-by='.lastTimestamp'

# Shell into a pod
kubectl exec -it -n ecommerce <pod-name> -- /bin/sh

# Copy files from pod
kubectl cp ecommerce/<pod-name>:/path/to/file ./local-file
```

---

## Next Steps

1. **Set up CI/CD pipeline** using GitHub Actions or GitLab CI
2. **Add monitoring** with Prometheus and Grafana
3. **Implement logging** with ELK/EFK stack
4. **Add ingress controller** for better routing
5. **Enable TLS/SSL** with cert-manager
6. **Implement backup strategy** for database
7. **Create Helm chart** for easier deployment

Your application is now running! 🎉
