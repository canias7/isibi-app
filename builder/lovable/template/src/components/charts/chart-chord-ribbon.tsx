import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChordRibbon } from "@/components/charts/lib/music2"
const chords = [
  { symbol: "G", beats: 4, degree: "I" },
  { symbol: "Em", beats: 4, degree: "vi" },
  { symbol: "C", beats: 2, degree: "IV" },
  { symbol: "D", beats: 2, degree: "V" },
  { symbol: "G", beats: 4, degree: "I" },
  { symbol: "Bm", beats: 2, degree: "iii" },
  { symbol: "Em", beats: 2, degree: "vi" },
  { symbol: "C", beats: 4, degree: "IV" },
  { symbol: "D", beats: 4, degree: "V" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Harmonic rhythm</CardTitle>
        <CardDescription>Chord duration and function through a chorus</CardDescription>
      </CardHeader>
      <CardContent>
        <ChordRibbon chords={chords} musicalKey="G major" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The tonic is only held twice <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Key of G
        </div>
      </CardFooter>
    </Card>
  )
}
