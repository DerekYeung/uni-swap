# 设置基础镜像,如果本地没有该镜像，会从Docker.io服务器pull镜像
FROM node:16
RUN mkdir -p /usr/share/zoneinfo/Asia/
RUN cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
  echo 'Asia/Shanghai' >/etc/timezone
# 创建app目录
RUN mkdir -p 777 /app/dependencies
RUN mkdir -p 777 /app/server

# 所以，正确的顺序是: 添加package.json；安装npm模块；添加源代码。
COPY package.json /app/dependencies/package.json
RUN cd /app/dependencies \
  && npm install \
  && ln -s /app/dependencies/node_modules /app/server/node_modules

COPY ./ /app/server/

WORKDIR /app/server

ENV EGG_SERVER_ENV prod

# 暴露容器端口
EXPOSE 7100

# 启动node应用
CMD node app