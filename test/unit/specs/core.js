var Vue = require('vue')
var Router = require('../../../src')
var nextTick = Vue.nextTick

describe('Core', function () {

  var router, el

  beforeEach(function () {
    el = document.createElement('div')
    spyOn(window, 'scrollTo')
  })

  it('matching views', function (done) {
    router = new Router({ abstract: true })
    router.map({
      '/a': { component: { template: 'AAA' }},
      '/b': { component: { template: 'BBB' }}
    })
    var App = Vue.extend({
      template: '<div><router-view></router-view></div>'
    })
    var cb = jasmine.createSpy()
    router.start(App, el, function () {
      expect(router.app).toBeTruthy()
      cb()
    })
    expect(cb).toHaveBeenCalled()
    assertRoutes([
      ['/a', 'AAA'],
      ['/b', 'BBB'],
      // relative
      ['a', 'AAA'],
      ['b', 'BBB'],
      // relative with traversal
      ['../a', 'AAA', '/a'],
      ['./../b', 'BBB', '/b'],
      // no match
      ['/c', '']
    ], done)
  })

  it('go() with object', function (done) {
    router = new Router({ abstract: true })
    router.map({
      '/a/:msg': {
        name: 'a',
        component: { template: 'A{{$route.params.msg}}' }
      },
      '/b/:msg': {
        name: 'b',
        component: { template: 'B{{$route.params.msg}}{{$route.query.msg}}<router-view></router-view>' },
        subRoutes: {
          '/c': {
            component: { template: 'C' }
          }
        }
      }
    })
    var App = Vue.extend({
      template: '<div><router-view></router-view></div>'
    })
    router.start(App, el)
    assertRoutes([
      [{ path: '/a/A' }, 'AA'],
      [{ path: '/b/B' }, 'BB'],
      // relative
      [{ path: '../a/A' }, 'AA'],
      [{ path: '../b/B' }, 'BB'],
      // relative with append: true
      [{ path: 'c', append: true }, 'BBC'],
      // named routes
      [{ name: 'a', params: {msg: 'A'}}, 'AA'],
      [{ name: 'b', params: {msg: 'B'}, query: {msg: 'B'}}, 'BBB']
    ], done)
  })

  it('matching nested views', function (done) {
    router = new Router({ abstract: true })
    router.map({
      '/a': {
        component: {
          template: 'VIEW A <router-view></router-view>'
        },
        subRoutes: {
          '/': {
            component: {
              template: 'SUB A DEFAULT'
            }
          },
          '/sub-a': {
            component: {
              template: 'SUB A'
            }
          },
          '/sub-a-2': {
            component: {
              template: 'SUB A2'
            }
          }
        }
      },
      '/b': {
        component: {
          template: 'VIEW B <router-view></router-view>'
        },
        subRoutes: {
          '/sub-b': {
            component: {
              template: 'SUB B'
            }
          }
        }
      }
    })
    var App = Vue.extend({
      template: '<div><router-view></router-view></div>'
    })
    router.start(App, el)
    assertRoutes([
      ['/a', 'VIEW A SUB A DEFAULT'],
      ['/a/sub-a', 'VIEW A SUB A'],
      ['/a/sub-a-2', 'VIEW A SUB A2'],
      ['/b/sub-b', 'VIEW B SUB B'],
      ['/b', 'VIEW B '],
      // no match
      ['/b/sub-a', '']
    ], done)
  })

  it('route context', function (done) {
    Vue.config.silent = true
    router = new Router({ abstract: true })
    router.map({
      '/a/:id': {
        customField: 'custom',
        component: {
          template: '{{$route.path}},{{$route.params.id}},{{$route.query.id}},{{$route.customField}}|'
        }
      }
    })
    var App = Vue.extend({
      template:
        '<div>' +
          '<router-view></router-view>' +
          // context should be available in non-router-view
          // components too.
          '<view-b></view-b>' +
        '</div>',
      components: {
        'view-b': {
          template: '{{$route.path}},{{$route.params.id}},{{$route.query.id}},{{$route.customField}}'
        }
      }
    })
    router.start(App, el)
    assertRoutes([
      // no param, no match (only view-b)
      ['/a', '/a,,,'],
      // params only
      ['/a/123', '/a/123,123,,custom|/a/123,123,,custom'],
      // params + query
      ['/a/123?id=234', '/a/123?id=234,123,234,custom|/a/123?id=234,123,234,custom'],
      // relative query
      ['?id=345', '/a/123?id=345,123,345,custom|/a/123?id=345,123,345,custom']
    ], function () {
      Vue.config.silent = false
      done()
    })
  })

  it('v-link', function (done) {
    router = new Router({ abstract: true })
    router.map({
      '/a': {
        component: {
          template:
            '<div>' +
              '<a id="link-a" v-link="{ path: \'b\' }">Link A</a>' +
            '</div>'
        }
      },
      '/b': {
        component: {
          data: function () {
            return { a: 'a' }
          },
          template:
            '<div>' +
              '<a id="link-b" v-link="{ path: \'/\' + a }">Link B</a>' +
              '<a id="link-c" v-link="{ path: c }"></c>' +
            '</div>'
        }
      },
      // test v-link with relative path + append
      '/c': {
        component: { template: '<a id="link-c" v-link="{ path: \'d\', append: true }">Link C</a><router-view></router-view>' },
        subRoutes: {
          '/d': {
            component: { template: '+D' }
          }
        }
      }
    })
    var App = Vue.extend({
      replace: false,
      template: '<router-view></router-view>'
    })
    router.start(App, el)
    router.go('/a')
    el = router.app.$el
    nextTick(function () {
      expect(el.textContent).toBe('Link A')
      var link = el.querySelector('#link-a')
      expect(link.getAttribute('href')).toBe('b')
      click(link)
      nextTick(function () {
        expect(el.textContent).toBe('Link B')
        var link = el.querySelector('#link-b')
        expect(link.getAttribute('href')).toBe('/a')
        // falsy expressions should not set href
        expect(el.querySelector('#link-c').hasAttribute('href')).toBe(false)
        click(link)
        nextTick(function () {
          expect(el.textContent).toBe('Link A')
          router.go('/c')
          nextTick(function () {
            expect(el.textContent).toBe('Link C')
            var link = el.querySelector('#link-c')
            click(link)
            nextTick(function () {
              expect(el.textContent).toBe('Link C+D')
              done()
            })
          })
        })
      })
    })
  })

  it('v-link active classes', function (done) {
    router = new Router({
      abstract: true,
      linkActiveClass: 'active'
    })
    var App = Vue.extend({
      replace: false,
      data: function () {
        return { className: 'custom' }
      },
      template:
        '<a id="link-a" v-link="{ path: \'/a\' }">Link A</a>' +
        '<a id="link-b" v-link="{ path: \'/b\', activeClass: className }">Link B</a>' +
        '<a id="link-c" v-link="{ path: \'/\', exact: true }">Link C</a>' +
        '<router-view></router-view>'
    })
    router.start(App, el)
    el = router.app.$el
    var linkA = el.querySelector('#link-a')
    var linkB = el.querySelector('#link-b')
    var linkC = el.querySelector('#link-c')
    expect(linkA.className).toBe('')
    expect(linkB.className).toBe('')
    expect(linkC.className).toBe('active')
    router.go('/a')
    nextTick(function () {
      expect(linkA.className).toBe('active')
      expect(linkB.className).toBe('')
      expect(linkC.className).toBe('')
      router.go('/a/b/c')
      nextTick(function () {
        expect(linkA.className).toBe('active')
        expect(linkB.className).toBe('')
        expect(linkC.className).toBe('')
        router.go('/b')
        nextTick(function () {
          expect(linkA.className).toBe('')
          expect(linkB.className).toBe('custom')
          expect(linkC.className).toBe('')
          router.app.className = 'changed'
          router.go('/b/c/d')
          nextTick(function () {
            expect(linkA.className).toBe('')
            expect(linkB.className).toBe('changed')
            expect(linkC.className).toBe('')
            router.go('/bcd')
            nextTick(function () {
              // #114 should not match
              expect(linkA.className).toBe('')
              expect(linkB.className).toBe('')
              expect(linkC.className).toBe('')
              done()
            })
          })
        })
      })
    })
  })

  it('v-link relative querystring', function (done) {
    router = new Router({ abstract: true })
    router.map({
      '/': {
        component: {
          template:
            '<div>' +
              '<router-view></router-view>' +
            '</div>'
        },
        subRoutes: {
          'foo': {
            component: {
              template:
                '<div>' +
                  '<a v-link="{ path: \'?id=1234\' }" id="link"></a>' +
                  '{{$route.query.id}}' +
                '</div>'
            }
          }
        }
      }
    })
    var App = Vue.extend({
      replace: false,
      template: '<router-view></router-view>'
    })
    router.start(App, el)
    router.go('/foo')
    nextTick(function () {
      click(router.app.$el.querySelector('#link'))
      nextTick(function () {
        var text = router.app.$el.textContent
        expect(text).toBe('1234')
        done()
      })
    })
  })

  it('v-link delegate', function (done) {
    // Safari and PhantomJS only propagates events if the
    // element is in the DOM!
    document.body.appendChild(el)
    router = new Router({ abstract: true })
    router.map({
      '/': {
        component: {
          template: '<div>Home</div>'
        }
      },
      '/foo': {
        component: {
          data: function () {
            return { home: '<a href="/">Link Home</a>' }
          },
          template: '<div id="wrap" v-html="home" v-link></div>'
        }
      }
    })
    var App = Vue.extend({
      replace: false,
      template: '<router-view></router-view>'
    })
    router.start(App, el)
    el = router.app.$el
    router.go('/foo')
    nextTick(function () {
      var wrap = el.querySelector('#wrap')
      var e = document.createEvent('Events')
      e.initEvent('click', true, true)
      e.button = 0
      var target = wrap.querySelector('a')
      target.dispatchEvent(e)
      nextTick(function () {
        var text = router.app.$el.textContent
        expect(text).toBe('Home')
        document.body.removeChild(el)
        done()
      })
    })
  })

  it('alias', function (done) {
    router = new Router({ abstract: true })
    router.map({
      '/a': { component: { template: 'AAA' }},
      '/b': { component: { template: 'BBB' }}
    })
    router.alias({
      '/c/a': '/a',
      '/c/b': '/b'
    })
    var App = Vue.extend({
      template: '<div><router-view></router-view></div>'
    })
    router.start(App, el)
    assertRoutes([
      ['/a', 'AAA'],
      ['/b', 'BBB'],
      ['/c/a', 'AAA'],
      ['/c/b', 'BBB']
    ], done)
  })

  it('multi-variable alias', function (done) {
    router = new Router({ abstract: true })
    router.map({
      '/a/:foo': {
        component: {
          template: '<router-view></router-view>'
        },
        subRoutes: {
          '/b/:bar': {
            component: {
              template: '{{$route.params.foo}}{{$route.params.bar}}'
            }
          }
        }
      }
    })
    router.alias({
      '/c/a/:foo/b/:bar': '/a/:foo/b/:bar'
    })
    var App = Vue.extend({
      template: '<div><router-view></router-view></div>'
    })
    router.start(App, el)
    assertRoutes([
      ['/c/a/123/b/456', '123456'],
      ['/c/a/234/b/567', '234567']
    ], done)
  })

  it('redirect', function (done) {
    router = new Router({ abstract: true })
    router.map({
      '/a': {
        component: {
          template: '<router-view></router-view>'
        },
        subRoutes: {
          '/b': {
            component: {
              template: 'hello'
            }
          },
          '/c': {
            component: {
              template: '{{$route.query.msg}}'
            }
          }
        }
      }
    })
    router.redirect({
      '/whatever': '/a/b',
      '/ok': '/a/c'
    })
    var App = Vue.extend({
      template: '<div><router-view></router-view></div>'
    })
    router.start(App, el)
    assertRoutes([
      ['/whatever', 'hello'],
      ['/ok?msg=world', 'world']
    ], done)
  })

  it('multi-variable redirect', function (done) {
    router = new Router({ abstract: true })
    router.map({
      '/a/:foo': {
        component: {
          template: '<router-view></router-view>'
        },
        subRoutes: {
          '/b/:bar': {
            component: {
              template: '{{$route.params.foo}}{{$route.params.bar}}'
            }
          }
        }
      }
    })
    router.redirect({
      '/c/a/:foo/b/:bar': '/a/:foo/b/:bar'
    })
    var App = Vue.extend({
      template: '<div><router-view></router-view></div>'
    })
    router.start(App, el)
    assertRoutes([
      ['/c/a/123/b/456', '123456'],
      ['/c/a/234/b/567', '234567']
    ], done)
  })

  it('notfound', function (done) {
    router = new Router({ abstract: true })
    router.map({
      '*': {
        component: {
          template: 'Whaaat'
        }
      }
    })
    var App = Vue.extend({
      template: '<div><router-view></router-view></div>'
    })
    router.start(App, el)
    expect(router.app.$el.textContent).toBe('Whaaat')
    assertRoutes([
      ['/notfound', 'Whaaat'],
      ['/notagain', 'Whaaat']
    ], done)
  })

  it('global before', function (done) {
    router = new Router({ abstract: true })
    var App = Vue.extend({
      template: '<div><router-view></router-view></div>'
    })
    router.map({
      '/no': {
        component: {
          template: '<p>NO</p>'
        }
      },
      'redirect/:id': {
        component: {
          template: 'should never show'
        }
      },
      '/to/:id': {
        component: {
          template: 'to {{$route.params.id}}'
        }
      },
      '*': {
        component: {
          template: '<p>default</p>'
        }
      }
    })

    var spy1 = jasmine.createSpy('before hook 1')
    router.beforeEach(function (transition) {
      spy1()
      setTimeout(function () {
        transition.next()
      }, wait)
    })

    var spy2 = jasmine.createSpy('before hook 2')
    router.beforeEach(function (transition) {
      spy2()
      if (transition.to.path === '/no') {
        setTimeout(function () {
          transition.abort()
          next()
        }, wait)
      } else if (transition.to.path.indexOf('/redirect') > -1) {
        setTimeout(function () {
          transition.redirect('/to/:id')
          next2()
        }, wait)
      } else {
        transition.next()
      }
    })

    router.start(App, el)
    expect(spy1).toHaveBeenCalled()
    expect(spy2).not.toHaveBeenCalled()
    expect(router.app.$el.textContent).toBe('')
    setTimeout(function () {
      expect(spy2).toHaveBeenCalled()
      expect(router.app.$el.textContent).toBe('default')
      router.go('/no')
    }, wait * 2)
    function next () {
      expect(spy1.calls.count()).toBe(2)
      expect(spy2.calls.count()).toBe(2)
      expect(router.app.$el.textContent).toBe('default')
      router.go('/redirect/12345')
    }
    function next2 () {
      expect(spy1.calls.count()).toBe(4) // go + redirect
      expect(spy2.calls.count()).toBe(3) // only go at this moment
      setTimeout(function () {
        expect(router.app.$el.textContent).toBe('to 12345')
        done()
      }, wait * 2)
    }
  })

  it('global after', function (done) {
    router = new Router({ abstract: true })
    var App = Vue.extend({
      template: '<div><router-view></router-view></div>'
    })
    router.map({
      '/a': {
        component: {
          template: '<p>a</p>'
        }
      }
    })
    var callCount = 0
    router.afterEach(function (transition) {
      if (callCount === 0) {
        // initial match
        expect(transition.from.path).toBeUndefined()
        expect(transition.to.path).toBe('/')
      } else {
        // second match
        expect(transition.from.path).toBe('/')
        expect(transition.to.path).toBe('/a')
        done()
      }
      callCount++
    })
    router.start(App, el)
    router.go('/a')
  })

  it('transitionOnLoad option', function (done) {
    router = new Router({
      abstract: true,
      transitionOnLoad: true
    })
    router.map({
      '/': {
        component: {
          template: '<p>whatever</p>'
        }
      }
    })
    var spy = jasmine.createSpy()
    var App = Vue.extend({
      template: '<div><router-view transition="test"></router-view></div>',
      transitions: {
        test: {
          enter: function (el, cb) {
            expect(el.tagName).toBe('P')
            spy()
            cb()
          }
        }
      }
    })
    // ensure el is inDoc otherwise transition won't trigger
    document.body.appendChild(el)
    router.start(App, el)
    nextTick(function () {
      expect(spy).toHaveBeenCalled()
      router.app.$destroy(true)
      done()
    })
  })

  if (!isIE9) {
    it('saveScrollPosition', function (done) {
      router = new Router({
        history: true,
        saveScrollPosition: true
      })
      router.map({
        '/a': { component: { template: 'hi' }}
      })
      router.start(Vue.extend({}), el)
      // record
      var x = window.pageXOffset
      var y = window.pageYOffset
      router.go('/a')
      nextTick(function () {
        window.addEventListener('popstate', function onPop () {
          nextTick(function () {
            expect(window.scrollTo).toHaveBeenCalledWith(x, y)
            window.removeEventListener('popstate', onPop)
            router.stop()
            done()
          })
        })
        history.back()
      })
    })

    it('slide to anchor', function (done) {
      router = new Router({
        history: true
      })
      router.map({
        '/a': { component: { template: '<a id="anchor">link</a>' }}
      })
      document.body.appendChild(el)
      router.start(Vue.extend({
        template: '<router-view></router-view>'
      }), el)
      router.go('/a#anchor')
      nextTick(function () {
        var anchor = document.getElementById('anchor')
        var x = window.scrollX
        var y = anchor.offsetTop
        expect(window.scrollTo).toHaveBeenCalledWith(x, y)
        router.stop()
        router.app.$destroy(true)
        window.addEventListener('popstate', function onPop () {
          window.removeEventListener('popstate', onPop)
          done()
        })
        history.back()
      })
    })

    it('async component', function (done) {
      router = new Router({
        abstract: true
      })
      router.map({
        '/a': {
          component: function (resolve) {
            setTimeout(function () {
              resolve({
                template: 'hello!'
              })
            }, wait)
          }
        }
      })
      router.start(Vue.extend({
        template: '<div><router-view></router-view></div>'
      }), el)
      router.go('/a')
      expect(router.app.$el.textContent).toBe('')
      setTimeout(function () {
        expect(router.app.$el.textContent).toBe('hello!')
        done()
      }, wait * 2)
    })

    it('async component abort', function (done) {
      var spy = jasmine.createSpy('async-component-abort')
      router = new Router({
        abstract: true
      })
      router.map({
        '/a': {
          component: function (resolve) {
            setTimeout(function () {
              resolve({
                template: 'hello!',
                created: spy
              })
            }, wait)
          }
        },
        '/b': {
          component: {
            template: 'B'
          }
        }
      })
      router.start(Vue.extend({
        template: '<div><router-view></router-view></div>'
      }), el)
      router.go('/a')
      expect(router.app.$el.textContent).toBe('')
      setTimeout(function () {
        router.go('/b')
        setTimeout(function () {
          expect(router.app.$el.textContent).toBe('B')
          expect(spy).not.toHaveBeenCalled()
          done()
        }, wait * 2)
      }, 0)
    })

    it('late-rendered view inside conditional blocks', function (done) {
      var component = {
        template:
          '<div>' +
            '<div v-if="show">' +
              '<router-view></router-view>' +
            '</div>' +
          '</div>',
        data: function () {
          return { show: false }
        },
        compiled: function () {
          var self = this
          setTimeout(function () {
            self.show = true
          }, wait)
        }
      }
      router = new Router({
        abstract: true
      })
      router.map({
        '/a': {
          component: component,
          subRoutes: {
            '/b': {
              component: {
                template: 'Rendered!'
              }
            }
          }
        }
      })
      router.start(Vue.extend(component), el)
      router.go('/a/b')
      setTimeout(function () {
        expect(router.app.$el.textContent).toBe('Rendered!')
        done()
      }, wait * 3)
    })
  }

  function assertRoutes (matches, options, done) {
    if (typeof options === 'function') {
      done = options
      options = {}
    }
    var match = matches.shift()
    router.go(match[0])
    nextTick(function () {
      var text = router.app.$el.textContent
      expect(text).toBe(match[1])
      if (matches.length) {
        assertRoutes(matches, options, done)
      } else {
        done()
      }
    })
  }

  function click (target) {
    var e = document.createEvent('HTMLEvents')
    e.initEvent('click', true, true)
    e.button = 0
    target.dispatchEvent(e)
  }
})
