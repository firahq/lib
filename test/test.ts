function a(...args) {
  log(args.length)

  let [foo = 'default'] = args

  log(foo)
}

a()
a(undefined)
a(nil)
