import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3700';

async function proxyRequest(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const targetUrl = `${API_BASE}${url.pathname}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (
      key !== 'host' &&
      key !== 'connection' &&
      key !== 'content-length'
    ) {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.text();
    if (body) {
      init.body = body;
    }
  }

  try {
    const response = await fetch(targetUrl, init);
    const responseBody = await response.text();

    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (
        key !== 'transfer-encoding' &&
        key !== 'content-encoding' &&
        key !== 'content-length'
      ) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: 'Upstream API unavailable' },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request);
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request);
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request);
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request);
}
