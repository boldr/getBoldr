# eslint-config-boldr

> Shareable default configuration for all around usage.

Feel free to extend or submit comments / corrections. Currently working through documenting rules with comments above them  😄

Included by default:
- [Babel](https://github.com/babel/eslint-plugin-babel)

Opt-in configurations
- [eslint-plugin-flowtype](https://github.com/gajus/eslint-plugin-flowtype)
- [eslint-plugin-import](https://github.com/benmosher/eslint-plugin-import)
- [eslint-plugin-react](https://github.com/yannickcr/eslint-plugin-react)
- [jsx-a11y](https://github.com/evcohen/eslint-plugin-jsx-a11y)


Adding an opt-in configuration
----
Simply extend the config you'd like to include, like below.
```json
{
  "extends": [
    "boldr", "boldr/react", "boldr/flowtype",
    "boldr/jsx-a11y", "boldr/import"
  ]
}
```
