let app_prefix = ''

export function init_localstorage_prefix(app: string) {
  app_prefix = `${app} `
}

type s<T> = {
  localstorage?: string
  url_param?: string
}

export function s<T>(initial_value: T, options: s<T> = {}) {
  const { localstorage, url_param } = options

  let state = initial_value

  const subs = set()
  function subscribe(listener: Function) {
    subs.add(listener)
  }

  function set_state(
    new_value?:
      | T
      | Promise<T>
      | ((old_value: T) => T | Promise<T> | void | Promise<void>),
  ): void

  function set_state(...args) {
    let new_value
    if (args.length == 0) {
      new_value = toggle
    } else {
      ;[new_value] = args
    }

    let prev_state = state

    if (is(new_value, 'function')) {
      new_value = new_value(prev_state)
    }

    if (is(new_value, 'literal') && new_value == prev_state) {
      return
    }

    if (is(new_value, Promise)) {
      new_value.then(set_state)
      return
    }

    if (!is(new_value, 'undefined')) {
      state = new_value
    }

    for (const sub of subs) {
      sub(state)
    }
  }

  function use_state(): [state: T, set_state: typeof set_state] {
    const update = use_update()

    use_effect(() => {
      subs.add(update)

      return () => {
        subs.delete(update)
      }
    }, [])

    return [state, set_state]
  }

  function set_state_key(key, ...args) {
    let new_value
    if (args.length == 0) {
      new_value = toggle
    } else {
      ;[new_value] = args
    }

    let prev_state = state[key]

    if (is(new_value, 'function')) {
      new_value = new_value(prev_state)
    }

    if (is(new_value, 'literal') && new_value == prev_state) {
      return
    }

    if (is(new_value, Promise)) {
      new_value.then((...args) => set_state_key(key, ...args))
      return
    }

    if (!is(new_value, 'undefined')) {
      state[key] = new_value
    }

    for (const sub of subs) {
      sub(state)
    }
  }

  function use_state_key<K extends keyof T>(
    key: K,
    fallback_value,
  ): [
    state: T[K],
    set_state: (
      new_value?:
        | T[K]
        | Promise<T[K]>
        | ((old_value: T[K]) => T[K] | Promise<T[K]> | void | Promise<void>),
    ) => void,
  ] {
    const update = use_update()

    use_effect(() => {
      subs.add(update)

      return () => {
        subs.delete(update)
      }
    }, [])

    return [
      state?.[key] ?? fallback_value,
      (new_value) => set_state_key(key, new_value),
    ]
  }

  const { parse: deserialize, stringify } = JSON
  function serialize() {
    return stringify(state)
  }

  if (is(localstorage, 'present')) {
    const key = `${app_prefix}${localstorage}`

    const value = localStorage.getItem(key)

    if (is(value, 'present')) {
      state = deserialize(value)
    }

    subscribe(() => {
      localStorage.setItem(key, serialize())
    })
  }

  if (is(url_param, 'present')) {
    const current_params = obj(new URL(window.location.href).searchParams)

    if (has(current_params, url_param)) {
      state = deserialize(current_params[url_param])
    }

    subscribe(sync_to_url)

    function sync_to_url() {
      const url = new URL(window.location.href)
      const prev_params = obj(url.searchParams)

      const prev_serialized_state = prev_params[url_param]
      const current_serialized_state = serialize()

      if (prev_serialized_state != current_serialized_state) {
        if (is(state, 'absent')) {
          url.searchParams.delete(url_param)
        } else {
          url.searchParams.set(url_param, serialize())
        }
        window.history.pushState({}, '', url)
      }
    }

    // Browser back / forward
    window.addEventListener('popstate', () => {
      const current_params = obj(new URL(window.location.href).searchParams)

      subs.delete(sync_to_url)

      if (has(current_params, url_param)) {
        set_state(deserialize(current_params[url_param]))
      } else {
        set_state(initial_value)
      }

      subs.add(sync_to_url)
    })
  }

  use_state.subscribe = subscribe
  use_state.key = use_state_key

  return use_state
}

function use_update() {
  const [, update] = useState(0)

  return () => update((v) => v + 1)
}

function toggle(v: boolean) {
  return !v
}

type s_fn = typeof s
declare global {
  var s: s_fn
}
