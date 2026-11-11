(function installYiyanCustomerApi(globalObject) {
  "use strict";

  const API_ENDPOINTS = Object.freeze({
    health: "/api/v1/health",
    advisorBindingPreview: "/api/v1/customer/advisor-binding/preview",
    advisorBindingConfirm: "/api/v1/customer/advisor-binding/confirm",
    advisorBindingCurrent: "/api/v1/customer/advisor-binding/current",
  });

  class CustomerApiError extends Error {
    constructor({ code, message, statusCode, requestId, details, cause }) {
      super(message);
      this.name = "CustomerApiError";
      this.code = code;
      this.statusCode = statusCode ?? null;
      this.requestId = requestId ?? null;
      this.details = details;

      if (cause !== undefined) {
        Object.defineProperty(this, "cause", {
          configurable: true,
          enumerable: false,
          value: cause,
          writable: true,
        });
      }
    }
  }

  function createCustomerApi(configuration = {}) {
    const runtimeConfiguration = globalObject.__YIYAN_RUNTIME_CONFIG__;
    const apiBaseUrl = resolveApiBaseUrl(
      configuration.apiBaseUrl ?? runtimeConfiguration?.apiBaseUrl,
    );
    const fetchImplementation = configuration.fetchImplementation
      ?? (typeof globalObject.fetch === "function"
        ? globalObject.fetch.bind(globalObject)
        : undefined);
    const accessTokenProvider = configuration.accessTokenProvider;

    if (typeof fetchImplementation !== "function") {
      throw new CustomerApiError({
        code: "API_FETCH_UNAVAILABLE",
        message: "当前运行环境不支持网络请求。",
      });
    }

    async function request(path, options = {}) {
      const method = options.method ?? "GET";
      const headers = {
        accept: "application/json",
        ...options.headers,
      };

      if (options.body !== undefined) {
        headers["content-type"] = "application/json";
      }

      if (options.authenticated !== false && typeof accessTokenProvider === "function") {
        const accessToken = await accessTokenProvider();
        if (typeof accessToken === "string" && accessToken.trim()) {
          headers.authorization = `Bearer ${accessToken.trim()}`;
        }
      }

      if (typeof options.idempotencyKey === "string" && options.idempotencyKey.trim()) {
        headers["idempotency-key"] = options.idempotencyKey.trim();
      }

      let response;
      try {
        response = await fetchImplementation(joinApiUrl(apiBaseUrl, path), {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
      } catch (cause) {
        throw new CustomerApiError({
          code: "API_NETWORK_ERROR",
          message: "网络连接失败，请检查网络后重试。",
          cause,
        });
      }

      const headerRequestId = readResponseHeader(response.headers, "x-request-id");
      let responseBody;
      try {
        responseBody = await response.json();
      } catch (cause) {
        throw new CustomerApiError({
          code: "API_INVALID_RESPONSE",
          message: "服务端返回格式不符合约定，请稍后重试。",
          statusCode: response.status,
          requestId: headerRequestId,
          cause,
        });
      }

      if (!response.ok) {
        throw errorFromResponse(responseBody, response.status, headerRequestId);
      }

      if (!isSuccessEnvelope(responseBody)) {
        throw new CustomerApiError({
          code: "API_INVALID_RESPONSE",
          message: "服务端返回格式不符合约定，请稍后重试。",
          statusCode: response.status,
          requestId: headerRequestId,
          details: responseBody,
        });
      }

      return responseBody;
    }

    return Object.freeze({
      health() {
        return request(API_ENDPOINTS.health, {
          method: "GET",
          authenticated: false,
        });
      },
      advisorBinding: Object.freeze({
        preview(input) {
          return request(API_ENDPOINTS.advisorBindingPreview, {
            method: "POST",
            body: input,
          });
        },
        confirm(input) {
          return request(API_ENDPOINTS.advisorBindingConfirm, {
            method: "POST",
            body: input,
            idempotencyKey: input?.idempotencyKey,
          });
        },
        current() {
          return request(API_ENDPOINTS.advisorBindingCurrent, {
            method: "GET",
          });
        },
      }),
    });
  }

  function resolveApiBaseUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new CustomerApiError({
        code: "API_BASE_URL_MISSING",
        message: "请先通过运行时配置提供 apiBaseUrl。",
      });
    }

    let url;
    try {
      url = new URL(value.trim());
    } catch (cause) {
      throw new CustomerApiError({
        code: "API_BASE_URL_INVALID",
        message: "apiBaseUrl 必须是有效的 HTTP(S) 地址。",
        cause,
      });
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new CustomerApiError({
        code: "API_BASE_URL_INVALID",
        message: "apiBaseUrl 必须使用 HTTP(S) 协议。",
      });
    }

    return url.toString().replace(/\/+$/, "");
  }

  function joinApiUrl(baseUrl, path) {
    const normalizedPath = String(path).replace(/^\/+/, "");
    return new URL(normalizedPath, `${baseUrl}/`).toString();
  }

  function isSuccessEnvelope(value) {
    return isRecord(value)
      && Object.prototype.hasOwnProperty.call(value, "data")
      && isRecord(value.meta)
      && typeof value.meta.requestId === "string"
      && value.meta.requestId.length > 0;
  }

  function isErrorEnvelope(value) {
    return isRecord(value)
      && isRecord(value.error)
      && typeof value.error.code === "string"
      && typeof value.error.message === "string";
  }

  function errorFromResponse(body, statusCode, headerRequestId) {
    if (isErrorEnvelope(body)) {
      return new CustomerApiError({
        code: body.error.code,
        message: body.error.message,
        statusCode,
        requestId: body.error.requestId ?? body.meta?.requestId ?? headerRequestId,
        details: body.error.details,
      });
    }

    return new CustomerApiError({
      code: "API_HTTP_ERROR",
      message: httpFallbackMessage(statusCode),
      statusCode,
      requestId: headerRequestId,
      details: body,
    });
  }

  function httpFallbackMessage(statusCode) {
    if (statusCode === 401) return "登录状态已失效，请重新登录。";
    if (statusCode === 403) return "当前账号没有执行此操作的权限。";
    if (statusCode === 404) return "请求的服务不存在或已下线。";
    if (statusCode === 409) return "数据状态已变化，请刷新后重试。";
    if (statusCode >= 500) return "服务暂时不可用，请稍后重试。";
    return "请求未成功，请检查后重试。";
  }

  function readResponseHeader(headers, name) {
    if (!headers) return null;
    if (typeof headers.get === "function") {
      const value = headers.get(name);
      return typeof value === "string" && value.trim() ? value.trim() : null;
    }

    const target = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === target && typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  globalObject.YiyanCustomerApi = Object.freeze({
    API_ENDPOINTS,
    CustomerApiError,
    createCustomerApi,
  });
})(typeof window === "undefined" ? globalThis : window);
