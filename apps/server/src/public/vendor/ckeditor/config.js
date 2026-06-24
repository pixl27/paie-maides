/**
 * @license Copyright (c) 2003-2015, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or http://ckeditor.com/license
 */

CKEDITOR.editorConfig = function( config ) {
	// Configuration générale
	config.language = 'fr';
	config.uiColor = '#3895FF';
    config.height = '500px';

	//contenu autorisé supplémentaire (en plus des elements standard)
	config.allowedContent = true;

	// Tools Bar
	// chargement des plugins
	// config.extraPlugins = 'tableresize,mdFieldSet,divarea'; // desactivation de divarea
	config.extraPlugins = 'tableresize,mdFieldSet';

	config.toolbar =
			[
				{ name: 'document',    items : [ 'Source','-','NewPage','DocProps','Preview','Print' ] },
				{ name: 'clipboard',   items : [ 'Cut','Copy','Paste','PasteText','PasteFromWord','-','Undo','Redo' ] },
				{ name: 'editing',     items : [ 'Find','Replace','-','SelectAll','-','SpellChecker', 'Scayt' ] },
				{ name: 'tools',       items : [ 'Maximize', 'ShowBlocks','-','About' ] },
				{ name: 'links',       items : [ 'Link','Unlink','Anchor' ] },
				{ name: 'insert',      items : [ 'Image','Flash','Table','HorizontalRule','Smiley','SpecialChar','PageBreak' ] },
				{ name: 'maides',      items : [ 'mdFieldSet'] },
				'/',
				{ name: 'styles',      items : [ 'Styles','Format','Font','FontSize' ] },
				{ name: 'basicstyles', items : [ 'Bold','Italic','Underline','Strike','Subscript','Superscript','-','RemoveFormat' ] },
				{ name: 'paragraph',   items : [ 'NumberedList','BulletedList','-','Outdent','Indent','-','Blockquote','CreateDiv','-','JustifyLeft','JustifyCenter','JustifyRight','JustifyBlock','-','BidiLtr','BidiRtl' ] },
				{ name: 'colors',      items : [ 'TextColor','BGColor' ] }
			];

};
