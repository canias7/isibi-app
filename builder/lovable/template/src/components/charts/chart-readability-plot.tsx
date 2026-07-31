import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ReadabilityPlot } from "@/components/charts/lib/biolang"
const docs = [
  { name: "Onboarding email", wordsPerSentence: 12, syllablesPerWord: 1.42 },
  { name: "Help centre", wordsPerSentence: 16, syllablesPerWord: 1.55 },
  { name: "Terms of service", wordsPerSentence: 28, syllablesPerWord: 1.86 },
  { name: "Blog post", wordsPerSentence: 19, syllablesPerWord: 1.5 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reading ease</CardTitle>
        <CardDescription>Sentence length against syllables per word</CardDescription>
      </CardHeader>
      <CardContent>
        <ReadabilityPlot docs={docs} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Up and to the right is harder <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Flesch reading ease
        </div>
      </CardFooter>
    </Card>
  )
}
