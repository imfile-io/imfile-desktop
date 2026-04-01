const queue = []
const maxLength = 5

export default {
  install: function (app, MessageApi, defaultOption = {}) {
    app.config.globalProperties.$msg = new Proxy(MessageApi, {
      get (obj, prop) {
        return (arg) => {
          if (!(arg instanceof Object)) {
            arg = { message: arg }
          }
          const task = {
            run () {
              obj[prop]({
                ...defaultOption,
                ...arg,
                onClose (...data) {
                  const currentTask = queue.pop()
                  if (currentTask) {
                    currentTask.run()
                  }
                  if (arg.onClose) {
                    arg.onClose(...data)
                  }
                }
              })
            }
          }

          if (queue.length >= maxLength) {
            queue.pop()
          }
          queue.unshift(task)

          if (queue.length === 1) {
            queue.pop().run()
          }
        }
      }
    })
  }
}
