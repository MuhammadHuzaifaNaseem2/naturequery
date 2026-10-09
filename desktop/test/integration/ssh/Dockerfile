# Minimal SSH jump host for tunnel tests. Password login, TCP forwarding on.
FROM alpine:3.20
# Package downloads use plain HTTP so the build also works behind networks
# that intercept HTTPS. Alpine packages are signature-checked either way.
RUN sed -i 's#https://#http://#' /etc/apk/repositories \
  && apk add --no-cache openssh \
  && ssh-keygen -A \
  && adduser -D tunnel \
  && echo 'tunnel:tunnel_pw' | chpasswd \
  && sed -i 's/^#\?AllowTcpForwarding.*/AllowTcpForwarding yes/' /etc/ssh/sshd_config \
  && sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
EXPOSE 22
CMD ["/usr/sbin/sshd", "-D", "-e"]
