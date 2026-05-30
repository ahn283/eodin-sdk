import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Slider } from "./ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { 
  Bell, 
  Check, 
  AlertCircle, 
  Info, 
  Copy,
  Download,
  Upload,
  Search,
  Settings,
  User,
  Mail,
  Phone,
  Calendar,
  Heart,
  Star,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "./ui/sonner";

export default function DesignSystem() {
  const [switchValue, setSwitchValue] = useState(false);
  const [sliderValue, setSliderValue] = useState([50]);
  const [progress, setProgress] = useState(33);

  const colors = [
    { name: "Primary Orange", value: "#fc8d42", description: "Main brand color" },
    { name: "Light Orange", value: "#ffa569", description: "Secondary brand color" },
    { name: "Dark Gray", value: "#363739", description: "Text and headings" },
    { name: "Success Green", value: "#10B981", description: "Success states" },
    { name: "Error Red", value: "#ef4444", description: "Error states" },
    { name: "Warning Yellow", value: "#f59e0b", description: "Warning states" },
    { name: "Info Blue", value: "#3b82f6", description: "Informational" },
  ];

  const typography = [
    { name: "Heading 1", element: "h1", classes: "text-4xl font-bold" },
    { name: "Heading 2", element: "h2", classes: "text-3xl font-bold" },
    { name: "Heading 3", element: "h3", classes: "text-2xl font-semibold" },
    { name: "Heading 4", element: "h4", classes: "text-xl font-semibold" },
    { name: "Body Large", element: "p", classes: "text-lg" },
    { name: "Body", element: "p", classes: "text-base" },
    { name: "Body Small", element: "p", classes: "text-sm" },
    { name: "Caption", element: "p", classes: "text-xs text-gray-600" },
  ];

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Hero Section */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-[#363739] mb-4">
              Eodin Design System
            </h1>
            <p className="text-lg text-[#363739]/70 max-w-3xl">
              A comprehensive design system featuring colors, typography, components, and UI patterns 
              for building consistent and accessible user interfaces.
            </p>
          </div>

          <Tabs defaultValue="colors" className="space-y-8">
            <TabsList className="bg-white border border-gray-200">
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="typography">Typography</TabsTrigger>
              <TabsTrigger value="buttons">Buttons</TabsTrigger>
              <TabsTrigger value="forms">Forms</TabsTrigger>
              <TabsTrigger value="components">Components</TabsTrigger>
            </TabsList>

            {/* Colors Tab */}
            <TabsContent value="colors" className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Brand Colors</CardTitle>
                  <CardDescription>
                    Core color palette for Eodin brand identity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {colors.map((color) => (
                      <div key={color.value} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                        <div
                          className="w-16 h-16 rounded-lg shadow-md ring-2 ring-white ring-offset-2"
                          style={{ backgroundColor: color.value }}
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold text-[#363739]">{color.name}</h4>
                          <p className="text-sm text-gray-600">{color.description}</p>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                            {color.value}
                          </code>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(color.value);
                            toast.success(`Copied ${color.value}`);
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gradients</CardTitle>
                  <CardDescription>
                    Pre-defined gradient combinations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-32 rounded-lg bg-gradient-to-r from-[#fc8d42] to-[#ffa569] flex items-center justify-center text-white font-semibold shadow-lg">
                      Primary Gradient
                    </div>
                    <div className="h-32 rounded-lg bg-gradient-to-br from-[#fc8d42] via-[#ffa569] to-[#fc8d42] flex items-center justify-center text-white font-semibold shadow-lg">
                      Radial Gradient
                    </div>
                    <div className="h-32 rounded-lg bg-gradient-to-r from-[#363739] to-[#fc8d42] flex items-center justify-center text-white font-semibold shadow-lg">
                      Dark to Orange
                    </div>
                    <div className="h-32 rounded-lg bg-gradient-to-br from-white to-[#FFF0E0] border border-gray-200 flex items-center justify-center text-[#363739] font-semibold shadow-lg">
                      Soft Background
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Typography Tab */}
            <TabsContent value="typography" className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Typography Scale</CardTitle>
                  <CardDescription>
                    Consistent text styles and hierarchies
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {typography.map((item) => {
                    const Element = item.element as keyof JSX.IntrinsicElements;
                    return (
                      <div key={item.name} className="border-b border-gray-100 pb-4 last:border-0">
                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-sm text-gray-500">{item.name}</span>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {item.classes}
                          </code>
                        </div>
                        <Element className={`${item.classes} text-[#363739]`}>
                          The quick brown fox jumps over the lazy dog
                        </Element>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Font Weights</CardTitle>
                  <CardDescription>
                    Available font weight variations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-lg font-light text-[#363739]">Light (300) - Elegant and airy</p>
                  <p className="text-lg font-normal text-[#363739]">Regular (400) - Default body text</p>
                  <p className="text-lg font-medium text-[#363739]">Medium (500) - Subtle emphasis</p>
                  <p className="text-lg font-semibold text-[#363739]">Semibold (600) - Headings and labels</p>
                  <p className="text-lg font-bold text-[#363739]">Bold (700) - Strong emphasis</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Buttons Tab */}
            <TabsContent value="buttons" className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Button Variants</CardTitle>
                  <CardDescription>
                    Different button styles for various use cases
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Primary Buttons</h4>
                    <div className="flex flex-wrap gap-3">
                      <Button className="bg-gradient-to-r from-[#fc8d42] to-[#ffa569] hover:from-[#e57a35] hover:to-[#fc8d42]">
                        Primary Button
                      </Button>
                      <Button className="bg-gradient-to-r from-[#fc8d42] to-[#ffa569] hover:from-[#e57a35] hover:to-[#fc8d42]">
                        <Download className="w-4 h-4 mr-2" />
                        With Icon
                      </Button>
                      <Button className="bg-gradient-to-r from-[#fc8d42] to-[#ffa569] hover:from-[#e57a35] hover:to-[#fc8d42]" disabled>
                        Disabled
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Secondary Buttons</h4>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="secondary">
                        <Upload className="w-4 h-4 mr-2" />
                        With Icon
                      </Button>
                      <Button variant="secondary" disabled>Disabled</Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Outline Buttons</h4>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline">Outline</Button>
                      <Button variant="outline">
                        <Search className="w-4 h-4 mr-2" />
                        With Icon
                      </Button>
                      <Button variant="outline" disabled>Disabled</Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Ghost Buttons</h4>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="ghost">Ghost</Button>
                      <Button variant="ghost">
                        <Settings className="w-4 h-4 mr-2" />
                        With Icon
                      </Button>
                      <Button variant="ghost" disabled>Disabled</Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Destructive Buttons</h4>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="destructive">Delete</Button>
                      <Button variant="destructive" variant="outline">
                        Remove
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Button Sizes</h4>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button size="sm" className="bg-[#fc8d42] hover:bg-[#e57a35]">Small</Button>
                      <Button size="default" className="bg-[#fc8d42] hover:bg-[#e57a35]">Default</Button>
                      <Button size="lg" className="bg-[#fc8d42] hover:bg-[#e57a35]">Large</Button>
                      <Button size="icon" className="bg-[#fc8d42] hover:bg-[#e57a35]">
                        <Bell className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Forms Tab */}
            <TabsContent value="forms" className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Form Elements</CardTitle>
                  <CardDescription>
                    Input fields, selects, checkboxes, and other form components
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Text Input */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="Enter your email" />
                  </div>

                  {/* Input with Icon */}
                  <div className="space-y-2">
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input id="search" type="text" placeholder="Search..." className="pl-10" />
                    </div>
                  </div>

                  {/* Textarea */}
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" placeholder="Enter your message" rows={4} />
                  </div>

                  {/* Select */}
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us">United States</SelectItem>
                        <SelectItem value="kr">South Korea</SelectItem>
                        <SelectItem value="jp">Japan</SelectItem>
                        <SelectItem value="cn">China</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Checkboxes */}
                  <div className="space-y-3">
                    <Label>Preferences</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="newsletter" />
                        <label htmlFor="newsletter" className="text-sm cursor-pointer">
                          Subscribe to newsletter
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="notifications" />
                        <label htmlFor="notifications" className="text-sm cursor-pointer">
                          Enable notifications
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="marketing" />
                        <label htmlFor="marketing" className="text-sm cursor-pointer">
                          Receive marketing emails
                        </label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Radio Group */}
                  <div className="space-y-3">
                    <Label>Plan Selection</Label>
                    <RadioGroup defaultValue="pro">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="free" id="free" />
                        <label htmlFor="free" className="text-sm cursor-pointer">
                          Free - $0/month
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pro" id="pro" />
                        <label htmlFor="pro" className="text-sm cursor-pointer">
                          Pro - $19/month
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="enterprise" id="enterprise" />
                        <label htmlFor="enterprise" className="text-sm cursor-pointer">
                          Enterprise - Custom pricing
                        </label>
                      </div>
                    </RadioGroup>
                  </div>

                  <Separator />

                  {/* Switch */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="airplane-mode">Airplane Mode</Label>
                      <p className="text-sm text-gray-500">Enable airplane mode</p>
                    </div>
                    <Switch
                      id="airplane-mode"
                      checked={switchValue}
                      onCheckedChange={setSwitchValue}
                    />
                  </div>

                  <Separator />

                  {/* Slider */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Volume</Label>
                      <span className="text-sm text-gray-500">{sliderValue}%</span>
                    </div>
                    <Slider
                      value={sliderValue}
                      onValueChange={setSliderValue}
                      max={100}
                      step={1}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Components Tab */}
            <TabsContent value="components" className="space-y-8">
              {/* Badges */}
              <Card>
                <CardHeader>
                  <CardTitle>Badges</CardTitle>
                  <CardDescription>
                    Labels and status indicators
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                    <Badge variant="outline">Outline</Badge>
                    <Badge className="bg-[#fc8d42] hover:bg-[#e57a35]">Custom</Badge>
                    <Badge className="bg-green-500 hover:bg-green-600">Success</Badge>
                    <Badge className="bg-blue-500 hover:bg-blue-600">Info</Badge>
                    <Badge className="bg-yellow-500 hover:bg-yellow-600">Warning</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle>Alerts</CardTitle>
                  <CardDescription>
                    Informational messages and notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Information</AlertTitle>
                    <AlertDescription>
                      This is an informational alert message.
                    </AlertDescription>
                  </Alert>

                  <Alert className="border-green-200 bg-green-50">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Success</AlertTitle>
                    <AlertDescription className="text-green-700">
                      Your changes have been saved successfully.
                    </AlertDescription>
                  </Alert>

                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-800">Warning</AlertTitle>
                    <AlertDescription className="text-yellow-700">
                      Please review your information before proceeding.
                    </AlertDescription>
                  </Alert>

                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                      An error occurred while processing your request.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              {/* Avatars */}
              <Card>
                <CardHeader>
                  <CardTitle>Avatars</CardTitle>
                  <CardDescription>
                    User profile images and fallbacks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-4">
                    <Avatar>
                      <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                      <AvatarFallback>CN</AvatarFallback>
                    </Avatar>
                    <Avatar>
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    <Avatar>
                      <AvatarFallback className="bg-[#fc8d42] text-white">EO</AvatarFallback>
                    </Avatar>
                    <Avatar className="w-16 h-16">
                      <AvatarFallback>LG</AvatarFallback>
                    </Avatar>
                  </div>
                </CardContent>
              </Card>

              {/* Progress */}
              <Card>
                <CardHeader>
                  <CardTitle>Progress</CardTitle>
                  <CardDescription>
                    Progress bars and loading indicators
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Upload Progress</span>
                      <span className="text-gray-500">{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Complete</span>
                      <span className="text-gray-500">100%</span>
                    </div>
                    <Progress value={100} className="[&>div]:bg-green-500" />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProgress(Math.max(0, progress - 10))}
                    >
                      Decrease
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProgress(Math.min(100, progress + 10))}
                    >
                      Increase
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Cards */}
              <Card>
                <CardHeader>
                  <CardTitle>Cards</CardTitle>
                  <CardDescription>
                    Container components with various layouts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-[#fc8d42]/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-[#fc8d42]" />
                          Feature Card
                        </CardTitle>
                        <CardDescription>
                          A beautiful card component
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600">
                          This card demonstrates the structure with header, content, and footer sections.
                        </p>
                      </CardContent>
                      <CardFooter>
                        <Button size="sm" className="bg-[#fc8d42] hover:bg-[#e57a35]">
                          Learn More
                        </Button>
                      </CardFooter>
                    </Card>

                    <Card className="bg-gradient-to-br from-[#fc8d42] to-[#ffa569] text-white border-0">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Star className="w-5 h-5" />
                          Premium Card
                        </CardTitle>
                        <CardDescription className="text-white/80">
                          With gradient background
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-white/90">
                          Styled with custom gradient and white text for emphasis.
                        </p>
                      </CardContent>
                      <CardFooter>
                        <Button size="sm" variant="secondary">
                          Upgrade Now
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              {/* Icons */}
              <Card>
                <CardHeader>
                  <CardTitle>Icons</CardTitle>
                  <CardDescription>
                    Lucide React icon library examples
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
                    {[
                      User, Mail, Phone, Calendar, Heart, Star, 
                      Bell, Settings, Search, Download, Upload, 
                      Check, AlertCircle, Info, Copy, Zap
                    ].map((Icon, index) => (
                      <div
                        key={index}
                        className="flex flex-col items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Icon className="w-6 h-6 text-[#fc8d42]" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Toast Demo */}
              <Card>
                <CardHeader>
                  <CardTitle>Toast Notifications</CardTitle>
                  <CardDescription>
                    Temporary notification messages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => toast.success("Success! Operation completed.")}
                    >
                      Show Success
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => toast.error("Error! Something went wrong.")}
                    >
                      Show Error
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => toast.info("Info: Here's some information.")}
                    >
                      Show Info
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => toast("Simple message")}
                    >
                      Show Default
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
