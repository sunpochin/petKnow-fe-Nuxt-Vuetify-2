import { UseFetchOptions } from "nuxt/app";
import type { FetchResponse, SearchParameters } from "ofetch";
import { alertDataType } from "@/components/AlertComponent.vue";

const alertData = inject<Ref<alertDataType>>("alertData")!;

export interface ResOptions<T> {
  data: T;
  status: number;
  message: string;
  isSuccess: boolean;
}

type UrlType =
  | string
  | Request
  | Ref<string | Request>
  | (() => string | Request);

export type HttpOption<T> = UseFetchOptions<ResOptions<T>>;

const handleError = <T>(
  response: FetchResponse<ResOptions<T>> & FetchResponse<ResponseType>
) => {
  const err = (text: string) => {
    alertData.value = {
      status: "error",
      content: response?._data?.message ?? text ?? "",
      visible: true,
    };
  };
  if (!response._data) {
    err("请求超时，服务器无响应！");
    return;
  }
  //   const userStore = useUserStore();
  const handleMap: { [key: number]: () => void } = {
    404: () => err("服务器资源不存在"),
    500: () => err("服务器内部错误"),
    403: () => err("没有权限访问该资源"),
    401: () => {
      err("登录状态已过期，需要重新登录");
      //   authStore.logout();
      // TODO 跳转实际登录页
      navigateTo("/");
    },
  };
  handleMap[response.status] ? handleMap[response.status]() : err("未知错误！");
};

// get方法传递数组形式参数
const paramsSerializer = (params?: SearchParameters) => {
  if (!params) return;

  const query = JSON.parse(JSON.stringify(params));
  Object.entries(query).forEach(([key, val]) => {
    if (typeof val === "object" && Array.isArray(val) && val !== null) {
      query[`${key}[]`] = toRaw(val).map((v: any) => JSON.stringify(v));
      delete query[key];
    }
  });
  return query;
};

const fetch = <T>(url: UrlType, option: UseFetchOptions<ResOptions<T>>) => {
  return useFetch<ResOptions<T>>(url, {
    // 请求拦截器
    onRequest({ options }) {
      // get方法传递数组形式参数
      options.params = paramsSerializer(options.params);
      // 添加baseURL,nuxt3环境变量要从useRuntimeConfig里面取
      const {
        public: { apiBase },
      } = useRuntimeConfig();
      if (apiBase) options.baseURL = apiBase;
      // 添加请求头,没登录不携带token
      options.headers = {
        "Content-Type": "application/json",
      };
      const accessToken = localStorage.getItem("accessToken");
      if (accessToken && options.headers) {
        options.headers = new Headers(options.headers);
        options.headers.set("Authorization", `Bearer ${accessToken}`);
      }
    },
    // 响应拦截
    onResponse({ response }) {
      if (response.status === 200 || response.status === 201)
        return response._data;

      // 在这里判断错误
      if (response._data.code !== 200 || response._data.code !== 201) {
        handleError<T>(response);
        return Promise.reject(response._data);
      }
      // 成功返回
      return response._data;
    },
    // 错误处理
    onResponseError({ response }) {
      handleError<T>(response);
      return Promise.reject(response?._data ?? null);
    },
    // 合并参数
    ...option,
  });
};

// 自动导出
export const useHttp = {
  get: async <T>(url: UrlType, params?: any, option?: HttpOption<T>) => {
    return await fetch<T>(url, { method: "get", params, ...option });
  },

  post: async <T>(url: UrlType, body?: any, option?: HttpOption<T>) => {
    return await fetch<T>(url, { method: "post", body, ...option });
  },

  patch: async <T>(url: UrlType, body?: any, option?: HttpOption<T>) => {
    return await fetch<T>(url, { method: "patch", body, ...option });
  },

  delete: async <T>(url: UrlType, body?: any, option?: HttpOption<T>) => {
    return await fetch<T>(url, { method: "delete", body, ...option });
  },
};
