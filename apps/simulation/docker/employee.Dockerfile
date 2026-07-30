FROM node:22-alpine

# Employee workstation container for ARM enterprise simulation.
# Each container represents one employee's computer running a coding agent
# on the armtest.com internal network.

WORKDIR /app
COPY employee-agent.js .

# Use a minimal entrypoint
CMD ["node", "employee-agent.js"]
