import React from 'react';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"

const TitleBar: React.FC = () => {
    return (
        <header className='w-full bg-white border-b border-gray-200 px-4 py-2 shadow-sm'>
            <div className='mx-auto flex items-center gap-3'>
                <div className='flex-shrink-0'>
                    <img
                        src='/KULEUVEN_CMYK_LOGO.png'
                        alt='logo'
                        className='h-12 w-auto'
                    />
                </div>
                <div className='flex-shrink-0'>
                    <img
                        src='/UHasselt-liggend.png'
                        alt='logo'
                        className='h-12 w-auto'
                    />
                </div>

                <div className='flex flex-col justify-center'>
                    <h1 className='text-xl font-semibold text-gray-800 leading-tight'>
                        Scene-aware collaborative 3D editor
                    </h1>

                    <nav className='w-fit'>
                        <Menubar>
                            <MenubarMenu>
                                <MenubarTrigger>File</MenubarTrigger>
                                {/*<MenubarContent>
                                <MenubarItem>
                                    New Tab <MenubarShortcut>⌘T</MenubarShortcut>
                                </MenubarItem>
                                <MenubarItem>New Window</MenubarItem>
                                <MenubarSeparator />
                                <MenubarItem>Share</MenubarItem>
                                <MenubarSeparator />
                                <MenubarItem>Print</MenubarItem>
                                </MenubarContent>*/}
                            </MenubarMenu>

                            <MenubarMenu>
                                <MenubarTrigger>Edit</MenubarTrigger>
                                <MenubarContent>
                                <MenubarItem>
                                    Undo <MenubarShortcut>CTRL + Z</MenubarShortcut>
                                </MenubarItem>
                                <MenubarItem>
                                    Redo <MenubarShortcut>CTRL + Y</MenubarShortcut>
                                </MenubarItem>
                                </MenubarContent>
                            </MenubarMenu>
 
                            {/*
                            <MenubarMenu>
                                <MenubarTrigger>Insert</MenubarTrigger>
                                <MenubarContent>
                                <MenubarItem>Cube</MenubarItem>
                                <MenubarItem>Sphere</MenubarItem>
                                </MenubarContent>
                            </MenubarMenu>
                            */}
                        </Menubar>
                    </nav>
                </div>
            </div>
        </header>
    );
};

export default TitleBar;