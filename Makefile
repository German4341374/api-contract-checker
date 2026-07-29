.PHONY: setup format lint typecheck test coverage build check demo-server docker-build clean

setup:
	npm ci

format:
	npm run format

lint:
	npm run format:check
	npm run lint

typecheck:
	npm run typecheck

test:
	npm test

coverage:
	npm run test:coverage

build:
	npm run build

check:
	npm run check

demo-server:
	npm run demo:server

docker-build:
	docker build --tag api-contract-checker:local .

clean:
	npm run clean
