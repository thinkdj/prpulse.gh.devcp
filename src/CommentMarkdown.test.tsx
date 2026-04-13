import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import CommentMarkdown from './components/CommentMarkdown'

afterEach(cleanup)

describe('CommentMarkdown — empty source', () => {
  it('shows "No description." for an empty string', () => {
    render(<CommentMarkdown source="" />)
    expect(screen.getByText('No description.')).toBeInTheDocument()
  })

  it('shows "No description." for a whitespace-only string', () => {
    render(<CommentMarkdown source="   " />)
    expect(screen.getByText('No description.')).toBeInTheDocument()
  })
})

describe('CommentMarkdown — basic markdown', () => {
  it('renders plain text', () => {
    render(<CommentMarkdown source="Hello world" />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders bold text', () => {
    render(<CommentMarkdown source="**important**" />)
    const strong = document.querySelector('strong')
    expect(strong).not.toBeNull()
    expect(strong!.textContent).toBe('important')
  })

  it('renders italic text', () => {
    render(<CommentMarkdown source="_italic_" />)
    const em = document.querySelector('em')
    expect(em).not.toBeNull()
    expect(em!.textContent).toBe('italic')
  })

  it('renders inline code', () => {
    render(<CommentMarkdown source="`const x = 1`" />)
    const code = document.querySelector('code')
    expect(code).not.toBeNull()
    expect(code!.textContent).toContain('const x = 1')
  })

  it('renders an unordered list', () => {
    render(<CommentMarkdown source={'- item one\n- item two'} />)
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it('renders an ordered list', () => {
    render(<CommentMarkdown source={'1. first\n2. second'} />)
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it('renders a blockquote', () => {
    render(<CommentMarkdown source="> quoted" />)
    const blockquote = document.querySelector('blockquote')
    expect(blockquote).not.toBeNull()
  })

  it('renders a horizontal rule', () => {
    render(<CommentMarkdown source={'line one\n\n---\n\nline two'} />)
    const hr = document.querySelector('hr')
    expect(hr).not.toBeNull()
  })

  it('renders a heading', () => {
    render(<CommentMarkdown source="# Big heading" />)
    // Our component maps h1 → h4
    expect(document.querySelector('h4')).not.toBeNull()
  })
})

describe('CommentMarkdown — safe links', () => {
  it('renders a safe https link as an anchor', () => {
    render(<CommentMarkdown source="[GitHub](https://github.com)" />)
    const link = screen.getByRole('link', { name: 'GitHub' })
    expect(link).toHaveAttribute('href', 'https://github.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders a relative path link as an anchor', () => {
    render(<CommentMarkdown source="[docs](/docs/readme)" />)
    const link = screen.getByRole('link', { name: 'docs' })
    expect(link).toHaveAttribute('href', '/docs/readme')
  })

  it('renders a javascript: URI as plain text (not a link)', () => {
    render(<CommentMarkdown source="[xss](javascript:alert(1))" />)
    expect(screen.queryByRole('link', { name: 'xss' })).toBeNull()
    expect(screen.getByText('xss')).toBeInTheDocument()
  })

  it('renders a data: URI as plain text (not a link)', () => {
    render(<CommentMarkdown source="[data](data:text/html,<h1>hi</h1>)" />)
    expect(screen.queryByRole('link', { name: 'data' })).toBeNull()
  })

  it('renders a vbscript: URI as plain text (not a link)', () => {
    render(<CommentMarkdown source="[v](vbscript:run())" />)
    expect(screen.queryByRole('link', { name: 'v' })).toBeNull()
  })
})

describe('CommentMarkdown — GitHub Flavoured Markdown (GFM)', () => {
  it('renders a GFM table', () => {
    const md = `
| Col A | Col B |
|-------|-------|
| 1     | 2     |
`
    render(<CommentMarkdown source={md} />)
    expect(document.querySelector('table')).not.toBeNull()
    expect(screen.getByText('Col A')).toBeInTheDocument()
  })

  it('renders a GFM task list checkbox (readonly)', () => {
    render(<CommentMarkdown source={'- [x] done\n- [ ] not done'} />)
    const checkboxes = document.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes.length).toBe(2)
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
    checkboxes.forEach((cb) => expect(cb).toBeDisabled())
  })

  it('renders strikethrough text', () => {
    render(<CommentMarkdown source="~~deleted~~" />)
    const del = document.querySelector('del')
    expect(del).not.toBeNull()
    expect(del!.textContent).toBe('deleted')
  })
})

describe('CommentMarkdown — image safety', () => {
  it('renders a safe image', () => {
    render(<CommentMarkdown source="![alt](https://example.com/img.png)" />)
    const img = document.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!).toHaveAttribute('src', 'https://example.com/img.png')
  })

  it('does not render an image with a javascript: src', () => {
    render(<CommentMarkdown source="![alt](javascript:alert(1))" />)
    expect(document.querySelector('img')).toBeNull()
  })
})

describe('CommentMarkdown — className prop', () => {
  it('applies the additional className to the wrapper div', () => {
    const { container } = render(
      <CommentMarkdown source="text" className="my-custom-class" />,
    )
    const wrapper = container.querySelector('.gh-comment-md')
    expect(wrapper?.className).toContain('my-custom-class')
  })
})
