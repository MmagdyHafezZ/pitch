#!/usr/bin/env bash
set -e

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

echo "----------------------------------------"
echo "🧰 Initial Project Setup"
echo "----------------------------------------"

# 1. Ensure .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  No $ENV_FILE found. Creating one from $ENV_EXAMPLE ..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo "✔️  .env created."
fi

# 2. Prompt missing env values
echo ""
echo "📝 Checking for missing environment variables..."
while IFS='=' read -r key default_val; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue

    if grep -q "^$key=" "$ENV_FILE"; then
        continue
    fi

    read -p "Enter value for $key (default: $default_val): " user_val
    user_val="${user_val:-$default_val}"
    echo "$key=$user_val" >> "$ENV_FILE"
done < "$ENV_EXAMPLE"

echo "✔️  Environment configured."
echo ""

# 3. Install dependencies

npm install -g pnpm
echo "📦 Installing dependencies..."
pnpm install

# 4. Start infra
echo "🐳 Starting Docker services..."
docker-compose up -d

# 5. Generate Prisma clients
echo "🔧 Generating Prisma clients..."
cd apps/api
pnpm db:generate:all

# 6. Run migrations
echo "📚 Applying database migrations..."
pnpm db:migrate:all

# 7. Build everything
echo "🏗️ Building the project..."
pnpm -w build

echo ""
echo "🎉 Setup complete! Now just run:"
echo "   ./start.sh"
